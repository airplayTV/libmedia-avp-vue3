export function getDefaultAssetBase() {
  return typeof __LIBMEDIA_AVP_DEFAULT_BASE__ === 'string'
    ? __LIBMEDIA_AVP_DEFAULT_BASE__
    : '/assets/libmedia-avp/'
}
