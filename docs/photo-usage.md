# Places photo usage
The carousel requests only its first image initially. Additional image elements are created only after an explicit swipe, keyboard navigation or dot selection. Returning to an already requested slide keeps its existing image element. Changing the photo set resets the request set.

This reduces requests; it is not a spending cap. The Nearby/Text Search usage counters do not include photo media requests. Monitor the separate Places API Place Details Photos SKU in Google Cloud billing and configure available quotas/alerts there. Billing alerts do not stop spending. Avoid prefetching hidden carousel slides or creating duplicate image elements for the same visible photo. Do not add persistent Google photo caching without checking the applicable Google terms.
