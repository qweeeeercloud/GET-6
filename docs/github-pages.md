# GitHub Pages 发布说明

这个项目已经配置 GitHub Actions 自动发布。推送到 GitHub 的 `main` 分支后，Actions 会运行测试、构建，并把 `dist` 发布到 GitHub Pages。

发布后需要在 GitHub 仓库里打开：

1. `Settings`
2. `Pages`
3. `Build and deployment`
4. `Source` 选择 `GitHub Actions`

如果仓库名是 `GET-6`，发布地址通常是：

```text
https://你的用户名.github.io/GET-6/
```

如果仓库名是 `你的用户名.github.io`，发布地址通常是：

```text
https://你的用户名.github.io/
```
