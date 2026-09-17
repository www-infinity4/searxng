FROM docker.io/searxng/searxng:latest

# Cloudflare Containers forwards requests to port 8080.
ENV SEARXNG_PORT=8080
ENV SEARXNG_BIND_ADDRESS=0.0.0.0
ENV SEARXNG_LIMITER=false

# The Phi frontends consume SearXNG's JSON search API.
RUN python -c "p='/etc/searxng/settings.yml'; s=open(p).read(); s=s.replace('  formats:\\n    - html', '  formats:\\n    - html\\n    - json'); open(p,'w').write(s)"

EXPOSE 8080
