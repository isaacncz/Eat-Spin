# Places photo usage
The carousel requests only its first image initially. Additional image elements are created only after an explicit swipe, keyboard navigation or dot selection. Returning to an already requested slide keeps its existing image element. Changing the photo set resets the request set.

This reduces requests; it is not a spending cap. The Nearby/Text Search usage counters do not include photo media requests. Monitor the separate Places API Place Details Photos SKU in Google Cloud billing and configure available quotas/alerts there. Billing alerts do not stop spending. Avoid prefetching hidden carousel slides or creating duplicate image elements for the same visible photo. Do not add persistent Google photo caching without checking the applicable Google terms.

## Full-screen viewer
Tapping a photo opens a full-screen viewer (`PhotoLightbox`). It is mounted only while open, so it makes no request before then. It holds one image element, for the photo on screen, and requests a larger variant of that Places photo (`maxHeightPx`/`maxWidthPx` = `VIEWER_PHOTO_MAX_PX`, derived by `toViewerPhotoUrl`; stored `photos` URLs are unchanged). If the larger request fails it falls back to the card-size URL. Neighbouring photos are not prefetched: another photo is requested only after an explicit previous/next button, arrow key or swipe.

Each viewed photo can therefore cost one extra Place Photos media request on top of the card image. The 1200px size was not checked against the current Places API (New) Place Photos documentation when it was added; confirm the allowed range there before changing it.
