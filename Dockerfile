# 1. Start from the official MySQL 8.0 image (same base you use now)
FROM mysql:8.0

# 2. Pre-configure the database, app user, and passwords
ENV MYSQL_DATABASE=medsync \
    MYSQL_USER=medsync_app \
    MYSQL_PASSWORD=medsync_pass \
    MYSQL_ROOT_PASSWORD=medsync_root

# 3. Copy the SQL files INTO the image's auto-init folder
COPY 0*.sql /docker-entrypoint-initdb.d/

# 4. Make the server default to utf8mb4 (matches your tables)
CMD ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]

# 5. Document the port the DB listens on
EXPOSE 3306