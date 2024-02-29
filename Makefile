.PHONY: copy

copy:
	rsync * -avz --exclude pb_data malina:smart-home

main:
	go build -o main main.go
	# upx main