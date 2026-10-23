# EatSpin Pizza Pick

The approved logo is concept C: a colourful pizza wheel with a selected wedge and a top pointer. The transparent master was generated from the approved concept board; preserve it when rebuilding shipping sizes.

Run `bash scripts/build-brand-icons.sh` with ImageMagick installed to rebuild PNG app icons, Apple-touch icon, ICO/favicons and the transparent in-app mark. Legacy copies in `src/components/favicon` are kept in sync. Icon generation is a local asset-preparation step; normal application/CI builds use the checked-in outputs and require no image tools or external services.

The yellow app-icon background and browser/PWA theme colour are `#FFD93D`. Service-worker cache versions must change when replacing same-name public assets so installed clients can fetch the updated branding.
