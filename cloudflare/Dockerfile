FROM docker.io/searxng/searxng:latest

ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=0.0.0.0
ENV SEARXNG_LIMITER=false
ENV SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml

COPY cloudflare/settings.yml /etc/searxng/settings.yml

EXPOSE 8080
