package internal

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/tools/cron"
)

var client = http.Client{}

func InitElectricityPriceUpdater(c *cron.Cron, cronExpression string) {
	electricityPriceUpdater()
	// if IsGoRun {
	// 	cronExpression = "* * * * *"
	// }
	c.MustAdd("electricityPriceUpdater", cronExpression, electricityPriceUpdater)
}

func electricityPriceUpdater() {
	Logger.Info("Fetching electricity prices")
	prices, err := fetchElectricityPrices()
	if err != nil {
		Logger.Warn("Failed to fetch electricity prices", "error", err)
		return
	}
	for _, price := range *prices {
		record, err := Dao.FindFirstRecordByData(ElectricityPricesCollection.Id, "date", formatSQLiteTime(price.StartDate))
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			Logger.Error("Error while fetching electricity price", "error", err)
			continue
		}
		if errors.Is(err, sql.ErrNoRows) {
			Logger.Warn("New electricity price", "startDate", price.StartDate, "value", price.Value, "unit", price.Unit)
			record = models.NewRecord(ElectricityPricesCollection)
		} else {
			oldValue := record.GetFloat("value")
			oldUnit := record.GetString("unit")

			sameValue := oldValue == price.Value
			if !sameValue {
				Logger.Warn("Electricity price has changed", "startDate", price.StartDate, "oldValue", oldValue, "newValue", price.Value)
			}
			sameUnit := oldUnit == price.Unit
			if !sameUnit {
				Logger.Warn("Electricity price unit has changed", "startDate", price.StartDate, "oldUnit", oldUnit, "newUnit", price.Unit)
			}
		}
		record.Set("date", price.StartDate)
		record.Set("value", price.Value)
		record.Set("unit", price.Unit)
		if err := Dao.SaveRecord(record); err != nil {
			Logger.Warn("Failed to save electricity price", "error", err)
		}
	}
}

type FortumTime time.Time

func (ft *FortumTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), "\"") + ":00Z"
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return err
	}
	*ft = FortumTime(t)
	return nil
}

type fortumResponse struct {
	Error  bool `json:"error"`
	Series []struct {
		StartDate FortumTime `json:"startDate"`
		Value     float64    `json:"value"`
		Unit      string     `json:"unit"`
	} `json:"series"`
}

type electricityPrice struct {
	StartDate time.Time
	Value     float64
	Unit      string
}

const FORTUM_API_BASEURL = "https://web.fortum.fi/api/v2"

func fetchElectricityPrices() (*[]electricityPrice, error) {
	req, err := http.NewRequest("GET", FORTUM_API_BASEURL+"/spot-price-anonymous", nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	q.Add("priceListKey", "1047")
	q.Add("from", FormatFortumTime(StartOfToday().UTC()))
	q.Add("to", FormatFortumTime(EndOfTomorrow().UTC()))
	req.URL.RawQuery = q.Encode()
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	fortumResponse, err := unmarshalResponse(resp.Body)
	if err != nil {
		return nil, err
	}
	if fortumResponse.Error {
		return nil, fmt.Errorf("fortum response contains error")
	}
	var electricityPrices []electricityPrice
	for _, series := range fortumResponse.Series {
		electricityPrices = append(electricityPrices, electricityPrice{
			StartDate: time.Time(series.StartDate),
			Value:     series.Value,
			Unit:      series.Unit,
		})
	}
	return &electricityPrices, nil
}

func unmarshalResponse(r io.Reader) (fortumResponse, error) {
	var response fortumResponse
	err := json.NewDecoder(r).Decode(&response)
	return response, err
}
