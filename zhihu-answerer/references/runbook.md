# 运行手册

## 1) 环境变量注入 Cookie

```bash
export ZHIHU_COOKIE='z_c0=...; d_c0=...; _zap=...; q_c1=...'
```

## 2) 执行脚本（默认草稿）

```bash
node scripts/post_answer_playwright.js \
  --url 'https://www.zhihu.com/question/123456789' \
  --content '这是自动化写入的回答内容。' \
  --mode draft
```

脚本会先判断你是否已回答该问题：  
- 未回答：走“写回答”发布  
- 已回答：走“编辑回答”替换全文后发布

## 3) 直接发布

```bash
node scripts/post_answer_playwright.js \
  --url 'https://www.zhihu.com/question/123456789' \
  --content '这是自动化写入的回答内容。' \
  --mode publish
```

发布模式会校验 `POST /api/v4/content/publish` 是否成功触发；输出里 `publishVerified=true` 才算真实发布成功。

## 4) 调试可视化浏览器

```bash
node scripts/post_answer_playwright.js \
  --url 'https://www.zhihu.com/question/123456789' \
  --content '调试模式内容' \
  --mode draft \
  --headless false
```

## 5) 在文末插入商品卡片（可多次传参）

```bash
node scripts/post_answer_playwright.js \
  --url 'https://www.zhihu.com/question/123456789' \
  --content '这是回答正文。文末将插入商品卡片。' \
  --product-url 'https://item.jd.com/100000000000.html' \
  --product-url 'https://detail.tmall.com/item.htm?id=1234567890' \
  --mode draft
```

也支持把商品链接直接写在 `--content` 正文中，脚本会自动提取这些淘宝/京东链接并从正文移除 URL，然后尝试插卡。

## 6) 商品卡发布注意项

- 若 `--mode publish` 且带 `--product-url`，正文需至少 200 个可见字符，否则脚本会直接报错停止。
- 商品面板若出现多个候选商品，脚本会跳过该链接以避免误插；该 URL 也不会保留在正文中。
- 若某个链接在知乎收益面板无法匹配商品卡，脚本会跳过并继续处理其他链接，不会中断整次发文。
