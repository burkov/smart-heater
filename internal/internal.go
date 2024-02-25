package internal

import (
	"log"
	"log/slog"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/daos"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

var App *pocketbase.PocketBase
var Dao *daos.Dao
var Logger *slog.Logger
var ElectricityPricesCollection *models.Collection

var IsGoRun = strings.HasPrefix(os.Args[0], os.TempDir())

func Init(app *pocketbase.PocketBase) {
	var err error
	App = app
	Logger = App.Logger()
	Dao = App.Dao()
	ElectricityPricesCollection, err = Dao.FindCollectionByNameOrId("electricity_prices")
	if err != nil {
		log.Panicln("Failed to find collection", "error", err)
	}
}

func EnableAutomigrations(app *pocketbase.PocketBase) {
	if IsGoRun {
		migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
			Automigrate: true,
		})
	}
}
