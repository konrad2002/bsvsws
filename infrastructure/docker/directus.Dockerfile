# Customized Directus image: pinned version + version-controlled extensions.
FROM directus/directus:12.6.0
COPY --chown=node:node directus/extensions/ /directus/extensions/
