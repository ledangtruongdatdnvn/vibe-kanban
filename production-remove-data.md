```bash
docker volume ls | grep -E 'host-data|remote-db-data|electric-data'
docker volume rm \
  ycyuogqfi5rdd6ljzt9yi308_host-data \
  ycyuogqfi5rdd6ljzt9yi308_remote-db-data \
  ycyuogqfi5rdd6ljzt9yi308_electric-data
```
