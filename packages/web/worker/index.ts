// This worker just serves the static SPA assets
// API calls go directly to the analysis worker
export default {
    fetch() {
      // Let Cloudflare Pages Assets handle everything
      return new Response(null, { status: 404 });
    },
  } satisfies ExportedHandler;