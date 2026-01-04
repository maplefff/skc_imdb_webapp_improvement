# SKC IMDb Webapp - 快速安裝指南

請幫我完成以下步驟：

1. Clone GitHub repository 到 `~/Downloads/skc_imdb_webapp`
2. 安裝依賴
3. 建構 macOS 應用程式
4. 將應用程式複製到 `/Applications`

Repository URL: https://github.com/maplefff/skc_imdb_webapp_improvement

請執行這些命令：
```bash
cd ~/Downloads
git clone https://github.com/maplefff/skc_imdb_webapp_improvement.git
cd skc_imdb_webapp_improvement
npm install
npm run build:mac
cp -r release/mac-arm64/SKCinema\ IMDb\ Rating.app /Applications/
```

完成後告訴我應用程式已安裝成功。
