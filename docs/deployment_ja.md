# デプロイ手順書

本サンプルをデプロイする手順を記載します。

## 前提条件

はじめに、AWS CDK を実行できる環境を用意してください。
これは、以下の条件を満たしている必要があります。

* 必要なソフトウェアがインストールされていること
  * [Node.js](https://nodejs.org/en/download/)
    * v16 以上を推奨
    * `node -v` コマンドで確認できます
  * [AWS CLI](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/getting-started-install.html)
    * v2 を推奨
    * `aws --version` コマンドで確認できます
* AWS CLI に適切な AWS IAM 権限 (Administrator 相当が必要) が設定されていること
  * IAM ロールの設定をするか、 `aws configure` コマンドで IAM ユーザーの情報を入力してください
* インターネットに接続され、AWS API と疎通できること
  * 閉域環境などでは、正常に実行できない可能性があります

上記を満たす環境であれば、ローカル端末や AWS Cloud9、EC2 インスタンス等で利用可能です。上記の条件が確認できたら、次の手順に進んでください。

## CDK の利用準備

はじめに、デプロイ先のリージョン名を `bin/unity-build-server.ts` の `region` に記入してください。以下は `us-east-1` リージョンにデプロイする場合の記入例です。

```typescript
const env: cdk.Environment = { region: 'us-east-1' };
```

本リポジトリのルートディレクトリ (`README.md` のあるディレクトリです) 直下の `/cdk` に移動し、以下のコマンドを実行してください。
なお、以降の `cdk` コマンドは全てこのディレクトリで実行することを想定しています。

```sh
# Node の依存パッケージをインストールします
npm ci
# ご利用の AWS 環境で CDK を利用できるように初期化を実行します
npx cdk bootstrap
```

`npm ci` は、Node の依存関係をインストールします。初回のみ必要です。

`cdk bootstrap` は、ご利用の環境で CDK を利用できるように初期設定をおこないます。
こちらはある AWS アカウント･あるリージョンで初めて CDK を利用する場合に必要です。2 回目以降は必要ありません。

✅ `Environment aws://xxxx/us-east-1 bootstrapped` という旨が表示されていれば成功です。次の手順に進んでください。

## デプロイ方法

CDK でスタック群をデプロイします。
デプロイ手順中に Unity ライセンス登録等の作業が必要となるため、スタックを複数回に分けてデプロイします。

1. 共通リソースのデプロイ
    * 以下のコマンドを実行し、AWS リソースをデプロイします
    * `npx cdk deploy UnityLicenseServerStack`
2. Unity ライセンスサーバーイメージの作成
    * Unity ライセンスサーバーの登録、ライセンスサーバーイメージ (AMI) の作成をおこないます
    * [AMI 作成手順書](./setup_license_ami_ja.md) を参照し、AMI を作成してください
    * AMI を作成し、AMI ID を確認できたら次の手順に進んでください
3. Unity ライセンスサーバーのデプロイ
    * 2 で作成した AMI の AMI ID を `bin/unity-build-server.ts` の `licenseServerAmiId` に転記し、保存してください
    * 以下のコマンドを実行し、Unity ライセンスサーバーをデプロイします
    * `npx cdk deploy UnityLicenseServerStack`

以上で Unity ライセンスサーバーのデプロイ作業は完了です。

## Unity ライセンスサーバーの動作確認方法

### テストクライアントによる動作確認

本リポジトリに付属のテストクライアントを利用して Unity ライセンスサーバーの動作確認を実行するための手順を記載します

* 以下のコマンドを実行し、テストクライアントをデプロイしてください
  * `npx cdk deploy UnityTestClientStack`
  * 接続のためのツール、設定ファイルはインスタンス起動時に自動的に取得されます
  
* テストクライアントにセッションマネージャー経由でログインし、下記のコマンドを実行することでフローティングライセンスの取得・返却が正常に実行できることを確認できます

```sh
# フローティングライセンス取得コマンド
[ssm-user@ip-10-0-157-181 bin]$ /opt/unityhub/UnityLicensingClient_V1/Unity.Licensing.Client --acquire-floating
Trying to acquire floating license from: 10.0.183.235 ...
License lease state: "Created" with token: "5ae15de4-132c-49fa-8893-6e0962459014" expires at: "2023-01-17T07:12:41.7537236Z" (in local time: "2023-01-17T07:12:41.7537236+00:00")

# フローティングライセンス返却コマンド
[ssm-user@ip-10-0-157-181 bin]$ TOKEN=5ae15de4-132c-49fa-8893-6e0962459014
[ssm-user@ip-10-0-157-181 bin]$ /opt/unityhub/UnityLicensingClient_V1/Unity.Licensing.Client --return-floating $TOKEN
Trying to return floating license lease (5ae15de4-132c-49fa-8893-6e0962459014) to: 10.0.183.235 ...
Failed to remove license file: /home/ssm-user/.config/unity3d/Unity/licenses/5ae15de4-132c-49fa-8893-6e0962459014.xml
Exception: Could not find a part of the path '/home/ssm-user/.config/unity3d/Unity/licenses/5ae15de4-132c-49fa-8893-6e0962459014.xml'.
License lease returned successfully
```

* ライセンスサーバーの動作確認終了後は以下のコマンドでテストクライアントを削除してください
  * `npx cdk destroy UnityTestClientStack`

### 自身で用意したクライアントでのライセンス取得

Unity ライセンスサーバーからライセンスを取得するには、クライアントの `/usr/share/unity3d/config/` に所定の形式の `services-config.json` を配置します。
以下のシェルコマンドを参考にしてください。

```sh
mkdir -p /usr/share/unity3d/config/
# Unity ライセンスサーバーの IP アドレスを記入してください
UNITY_BUILD_SERVER_URL=xxx.xxx.xxx.xxx
echo '{
"licensingServiceBaseUrl": "'"$UNITY_BUILD_SERVER_URL"'",
"enableEntitlementLicensing": true,
"enableFloatingApi": true,
"clientConnectTimeoutSec": 5,
"clientHandshakeTimeoutSec": 10}' > /usr/share/unity3d/config/services-config.json
```

このファイルが存在する状態で Unity Editor をバッチモードで起動すると、自動的にライセンスの取得・解放が処理されます。

## リソースの削除

注: ライセンスサーバーにアタッチされている ENI を削除した場合、当該 ENI に紐づけられた Unity ライセンスは使用できなくなり、ユーザからライセンスを復旧することはできません。削除手順を実行する際にご留意ください。

リソースを削除する際は、以下の手順に沿ってください。

まずは ENI の removal policy を変更します。このために [`cdk/bin/unity-build-server.ts`](cdk/bin/unity-build-server.ts) を以下のように編集してください:

```diff
const serverStack = new UnityLicenseServerStack(app, 'UnityLicenseServerStack', {
  env,
-  retainEni: false,
+  retainEni: true,
});
```

次にスタックをデプロイして変更を適用します:

```
npx cdk deploy UnityLicenseServerStack
```

デプロイが完了したら、以下のコマンドを実行してください:

```sh
npx cdk destroy --all
```

いくつかのリソースを自動で削除しないようにしています。以下の手順に沿って、手動で削除してください。

* ライセンスサーバー AMI: `license-ami-stack` の手順内で作成した AMI を削除する場合は [こちらのページ](https://docs.aws.amazon.com/ja_jp/AWSEC2/latest/UserGuide/deregister-ami.html) を参考にしてください。


## FAQ

Q1. ライセンスを更新する場合はどのような手順が必要ですか

Answer: ライセンスアーカイブを再度 Unity ID Portal からダウンロードし、インポートする必要があります。詳しくは[こちらのページ](https://support.unity.com/hc/ja/articles/5041642079636)を参考にしてください。
