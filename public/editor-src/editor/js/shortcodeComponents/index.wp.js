import nonWP from "./index.js";
// import WPPosts from "./WordPress/WPPosts";
import WPSidebar from "./WPSidebar";
import WPCustomShortcode from "./WPCustomShortcode";
import WOOProducts from "./WOOProducts";
import WOOProductPage from "./WOOProductPage";
import WOOCategories from "./WOOCategories";
// import WOOAddToCart from "./WOOAddToCart";
import WOOPages from "./WOOPages";

import { hasSidebars, pluginActivated } from "visual/utils/wp";

export default {
  ...nonWP,
  wordpress: [...(hasSidebars() ? [WPSidebar] : []), WPCustomShortcode],
  woocommerce: [
    ...(pluginActivated("woocommerce")
      ? [WOOProducts, WOOProductPage, WOOCategories, WOOPages]
      : [])
  ]
};
