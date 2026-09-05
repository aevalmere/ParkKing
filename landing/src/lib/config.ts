/** The single destination this page leads to: the free demo, which ships
    beside this page in the same repository (../parkkingdemo/ in source,
    /ParkKing/parkkingdemo/ on the live GitHub Pages site). The path is
    RELATIVE, like every other reference on this page, so it resolves under
    the /ParkKing/ project-site prefix and at any other mount. Written with
    the explicit `index.html` rather than the bare directory so it works on
    any static server, including ones that don't resolve directory indexes. */
export const DEMO_URL = 'parkkingdemo/index.html'

/** Ethan's main site. ParkKing used to live at /parkking/ on it and now has
    this repository of its own, so every link back there must be absolute. */
export const HOME_URL = 'https://ethan-zhang.lightsdarke.workers.dev/'

/** The write-up behind this project, on the main site. ParkKing is a practice
    piece, and the post is where the reasoning lives — so every page here links
    back to it rather than pretending the pitch stands on its own. */
export const BLOG_URL = 'https://ethan-zhang.lightsdarke.workers.dev/blog/building-parkking'
