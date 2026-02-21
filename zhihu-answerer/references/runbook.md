# 运行手册

## 1) 准备 Cookie 文件

将完整 Cookie 请求头字符串写入 `~/.config/zhihu_cookie.txt`（单行）：

```bash
mkdir -p ~/.config
cat > ~/.config/zhihu_cookie.txt <<'EOF'
z_c0=...; d_c0=...; _zap=...; q_c1=...; SESSIONID=...
EOF
```

## 2) 直接发布（默认流程）

```bash
node scripts/post_answer_playwright.js \
  --url 'https://www.zhihu.com/question/123456789' \
  --content '这是自动化写入的回答内容。' \
  --mode publish
```

脚本会先判断是否已回答该问题：  
- 未回答：走“写回答”发布  
- 已回答：走“编辑回答”替换全文后发布

发布会校验 `POST /api/v4/content/publish` 是否成功触发；输出中 `publishVerified=true` 才算真实发布成功。

## 3) 调试可视化浏览器

```bash
node scripts/post_answer_playwright.js \
  --url 'https://www.zhihu.com/question/123456789' \
  --content '调试模式内容' \
  --mode publish \
  --headless false
```

## 4) 在文末插入商品卡片（可多次传参）

```bash
node scripts/post_answer_playwright.js \
  --url 'https://www.zhihu.com/question/123456789' \
  --content '这是回答正文。文末将插入商品卡片。' \
  --product-url 'https://item.jd.com/100000000000.html' \
  --product-url 'https://detail.tmall.com/item.htm?id=1234567890' \
  --mode publish
```

也支持把商品链接直接写在 `--content` 中，脚本会自动提取这些淘宝/京东链接并从正文移除 URL，然后尝试插卡。

## 5) 商品卡发布注意项

- 带商品卡发布时，正文去除 URL 后可见字符需至少 200，否则脚本会直接报错停止。
- 商品面板若出现多个候选商品，脚本会跳过该链接以避免误插，且不会保留原始 URL。
- 某链接无法匹配商品卡时会记录跳过原因并继续，不中断整次发布。

## 6) 常见失败原因

- `Cannot read cookie file`: `~/.config/zhihu_cookie.txt` 不存在或不可读。
- `Cookie file is empty`: 文件存在但内容为空。
- `Cookie seems invalid`: 登录态过期或无效，需要更新 Cookie 文件。
