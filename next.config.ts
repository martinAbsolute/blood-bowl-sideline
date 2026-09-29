import type { NextConfig } from "next";
import { withGTConfig } from "gt-next/config";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{source:"/(.*)",headers:[
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    ]},{source:"/auth/:path*",headers:[{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"no-store"}]}];
  },
};
export default withGTConfig(nextConfig, {
  defaultLocale:"en", locales:["en","uk"], ignoreBrowserLocales:true,
  dictionary:"./src/dictionary.ts",loadDictionaryPath:"./src/loadDictionary.ts",loadTranslationsPath:"./src/loadTranslations.ts",
  getLocalePath:"./src/getLocale.ts",cacheUrl:null,runtimeUrl:null,
  headersAndCookies:{localeCookieName:"bbs_locale"},
});
