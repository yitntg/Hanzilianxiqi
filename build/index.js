// Worker脚本 - 服务静态内容
export default {
  async fetch(request, env, ctx) {
    return new Response("<html><body>汉字笔顺大师PRO即将上线</body></html>", {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },
}; 