package main

import (
	"log"

	"github.com/burkov/smart-home/internal"
	_ "github.com/burkov/smart-home/migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/cron"
)

func main() {
	internal.App = pocketbase.New()
	internal.EnableAutomigrations(internal.App)
	internal.App.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		internal.Init(internal.App)
		scheduler := cron.New()
		internal.InitElectricityPriceUpdater(scheduler, "0 */4 * * *") // on the 0th minute of every 4th hour
		internal.InitDisplayUpdater(scheduler, "1 */1 * * *")          // on the 1th minute of every hour
		scheduler.Start()
		return nil
	})

	if err := internal.App.Start(); err != nil {
		log.Fatal(err)
	}
}
