# weasyprint-pdf — containerized "HTML → PDF" service.
# Debian-based Node image so we can apt-install WeasyPrint with its native stack
# (Pango/cairo/etc.) instead of bundling Python libs by hand.
FROM node:20-slim

# WeasyPrint + broad font families so most scripts render.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       weasyprint \
       fonts-dejavu \
       fonts-noto-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs ./

ENV PORT=8080
EXPOSE 8080

# Drop root for the runtime.
USER node

CMD ["node", "server.mjs"]
