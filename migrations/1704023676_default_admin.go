package migrations

import (
	"github.com/burkov/smart-home/config"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)
		admin := &models.Admin{}
		admin.Email = config.ADMIN_EMAIL
		admin.SetPassword(config.ADMIN_PASSWORD)
		return dao.SaveAdmin(admin)
	}, func(db dbx.Builder) error {
		dao := daos.New(db)
		admin, _ := dao.FindAdminByEmail(config.ADMIN_EMAIL)
		if admin != nil {
			return dao.DeleteAdmin(admin)
		}
		return nil
	})
}
