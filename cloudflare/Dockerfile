FROM docker.io/searxng/searxng:latest

# Infinity Phi needs JSON responses from /search and the container must listen
# on the port Cloudflare Containers forwards to.
ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=0.0.0.0
ENV SEARXNG_LIMITER=false

RUN sed -i '/formats:/,/^[^ ]/ { /- html/a\    - json
}' /etc/searxng/settings.yml

EXPOSE 8080
