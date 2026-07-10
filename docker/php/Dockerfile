FROM php:8.2-fpm

RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libpq-dev \
    libzip-dev \
    && docker-php-ext-install -j$(nproc) pdo_pgsql pgsql zip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/conf.d/99-dev.ini /usr/local/etc/php/conf.d/99-dev.ini
COPY docker/php/conf.d/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/api

COPY api/composer.json api/composer.lock* ./
COPY shared /var/www/shared

RUN composer install --no-interaction --prefer-dist

COPY api /var/www/api

RUN composer dump-autoload --optimize
