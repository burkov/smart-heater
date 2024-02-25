package internal

import (
	"log"
	"time"

	"github.com/burkov/smart-home/display"
	"github.com/pocketbase/pocketbase/tools/cron"
	"golang.org/x/exp/io/i2c"
)

func InitDisplayUpdater(scheduler *cron.Cron, schedule string) {
	updateGrooveDisplay()
	// if IsGoRun {
	// 	cronExpression = "* * * * *"
	// }
	// scheduler.MustAdd("grooveLcdUpdater", schedule, updateGrooveDisplay)
}

func updateGrooveDisplay() {
	d, err := display.Open(&i2c.Devfs{Dev: "/dev/i2c-1"})
	if err != nil {
		log.Fatal(err)
	}
	defer d.Close()
	if err := d.SetRGB(0, 128, 64); err != nil {
		log.Fatal(err)
	}
	for {
		if err := d.SetText("Hello gopher!"); err != nil {
			log.Fatal(err)
		}
		time.Sleep(400 * time.Millisecond)
		if err := d.Clear(); err != nil {
			log.Fatal(err)
		}
		time.Sleep(400 * time.Millisecond)
	}
}
