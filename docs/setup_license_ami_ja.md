# ライセンスサーバー (Build Server) の AMI 作成手順

ライセンスサーバーで利用する AMI 作成のため、以下の作業を実施します。

## Introduction

本手順書内での「ライセンス」とは、 Unity Build Server のライセンスを指します。詳細な仕様については[こちらのページ](https://forpro.unity3d.jp/unity-build-server/)をご確認ください。

ライセンスサーバー (Unity Build Server) はクライアントからの要求に応じて floating license を発行します。ライセンスはサーバーの MAC アドレス (EC2 インスタンスでは primary ENI) に対して紐づいており、一度設定した後からは変更できません。EC2 インスタンスを新しく作成してもライセンスの有効な状態を維持するため、ENI を使い回し、起動時に primary ENI としてアタッチすることでこの制約に適合します。

ライセンス登録の過程で UnityID Portal との間でファイルをやり取りする手順が含まれるため、ライセンスサーバーの AMI 作成には本文書で示すように複数回の `npx cdk deploy`, `npx cdk destroy` や手動でのコマンド実行が必要となります。

## 前提条件

AMI 作成に前もって、以下の条件が満たされていることを確認してください。

* S3 Bucket, VPC 等共通リソースのデプロイが完了していること
  * `npx cdk deploy UnityLicenseServerStack` が正常に完了していることを確認してください
* 有効な未割り当ての Unity ライセンスを保有していること
  * Unity Build Server のライセンス購入、もしくは試用クーポンの取得が完了していることを確認してください

## 手順

以下の手順を実行することでライセンスサーバーの AMI が作成されます。
明示しない限り、以下のコマンドは ssm-user のホームディレクトリで実行してください。

1. 共通リソースの S3 Bucket (`UnityLicenseServerStack` の `Bucket`、以下同様) に [UnityID Portal](https://id.unity.com/en/account/edit) からダウンロードしたバイナリ (`Unity.Licensing.Server.linux-x64-{version}.zip`) を配置します
    * [マネジメントコンソール](https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1) からのアップロードを推奨します
    * 手元で CLI 経由でアップロードする場合のコマンド例: `aws s3 cp ./Unity.Licensing.Server.linux-x64-v1.11.0.zip s3://unitylicenseserverstack-bucket-xxxxxxx/`

2. AMI 作成用のスタックをデプロイします
    * 手元で次のコマンドを実行してください: `npx cdk deploy UnityLicenseServerAmiStack`
    * `UnityLicenseServerAmiStack` で起動した EC2 インスタンスを AMI の雛形として利用します
    * 雛形インスタンスにセッションマネージャー経由で接続し、以下のコマンドを順に実行します (接続方法については後述)

    ```sh
    pwd
    # > /home/ssm-user

    # 共通リソースで作成された S3 Bucket 名をここで代入してください
    BUCKET_NAME='unitylicenseserverstack-bucket-xxxxxxx'
    # S3 バケットに配置したバイナリのファイル名をここで代入してください
    BIN_ZIP_FILE_NAME='Unity.Licensing.Server.linux-x64-{version}.zip'
    aws s3 cp s3://$BUCKET_NAME/$BIN_ZIP_FILE_NAME ./
    # 名称任意で Unity.Licensing.Server の作業用ディレクトリを作成します
    mkdir UnityLicensingServer
    unzip $BIN_ZIP_FILE_NAME -d UnityLicensingServer/

    pwd
    # > /home/ssm-user/UnityLicensingServer
    # 対話形式でのセットアップが開始します
    ./Unity.Licensing.Server setup
    # ... セットアップ例は後述

    # server-registration-request.xml, services-config.json のパスがそれぞれ表示されていることを確認したら以下の手順に進んでください

    # server-registration-request.xml を S3 に保存
    aws s3 cp ./server-registration-request.xml s3://$BUCKET_NAME/
    # > upload: ./server-registration-request.xml to s3://xxxxxx/server-registration-request.xml\

    # services-config.json を S3 に保存
    aws s3 cp ./services-config.json s3://$BUCKET_NAME/
    # > upload: ./services-config.json to s3://xxxxxx/services-config.json

    # 一旦雛形インスタンスへの接続を停止し、マネジメントコンソール/UnityID Portal での操作に移ります
    ```

3. S3 Bucket にアップロードされた `server-registration-request.xml` をダウンロードし、[ガイド](https://forpro.unity3d.jp/tutorial/unity-build-server%E3%82%AF%E3%82%A4%E3%83%83%E3%82%AF%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%88%E3%82%AC%E3%82%A4%E3%83%89/) にしたがって UnityID Portal 上でライセンスの割り当て、ライセンスアーカイブ (`{ライセンスサーバ名}.zip`) のダウンロードを実行します

4. ライセンスアーカイブを S3 Bucket に配置します

5. 再度雛形インスタンスにセッションマネージャー経由で接続し、以下のコマンドを順に実行します (詳細は [ガイド](https://forpro.unity3d.jp/tutorial/unity-build-server%E3%82%AF%E3%82%A4%E3%83%83%E3%82%AF%E3%82%B9%E3%82%BF%E3%83%BC%E3%83%88%E3%82%AC%E3%82%A4%E3%83%89/) を参照してください)

    ```sh
    # 共通リソースで作成された S3 Bucket 名をここで代入してください
    BUCKET_NAME='sample-bucket-name'
    # S3 Bucket にアップロードしたライセンスアーカイブのファイル名をここで代入してください
    ARCHIVE_ZIP_FILE_NAME='unitylicenseserver.zip'
    # ライセンスアーカイブのダウンロード
    aws s3 cp s3://$BUCKET_NAME/$ARCHIVE_ZIP_FILE_NAME ~/
    # > download: s3://xxxxxx/yyyyyy.zip to ./yyyyyy.zip

    # ライセンスアーカイブのインポート
    cd UnityLicensingServer/
    ./Unity.Licensing.Server import ~/$ARCHIVE_ZIP_FILE_NAME

    # Successfully imported licensing files. You may run the server. と表示されることを確認

    # ライセンスサーバーをサービスとして登録
    sudo ./Unity.Licensing.Server create-service

    # 正常に動作していることを確認 (ip は services-config.json に記載)
    curl http://xxx.xxx.xxx.xxx:8080/v1/admin/status | jq .
    ```

6. マネジメントコンソールから 雛形インスタンスの AMI を作成する
    * AMI 作成手順: [公式ドキュメント](https://docs.aws.amazon.com/ja_jp/toolkit-for-visual-studio/latest/user-guide/tkv-create-ami-from-instance.html)
    * 作成には10分程度必要ですので、AMI 作成が完了するまで待機してください

7. 6 で作成した AMI ID を `unity-license-server.ts` の `licenseServerAmiId` に転記し、保存する

8. ENI をインスタンスから解放するため、AMI 作成に利用したスタックを削除します
    * `npx cdk destroy UnityLicenseServerAmiStack`

9. AMI の作成手順は以上です。[deployment.md](deployment_ja.md) へ戻り、デプロイ作業を続行してください

### セットアップ対話例

UnityID Portal からダウンロードしたバイナリファイルでのセットアップ手順 (`./Unity.Licensing.Server setup`) の実行例を示します。

```sh
# ./Unity.Licensing.Server setup 例
- - - -
Welcome to Unity Licensing Server setup command line interface.
This setup will help you configure your license server and generate server registration request file.
- - - -

# 任意のサーバー名を入力してください。UnityID Portal 上での識別に利用されます。
Enter the server name (e.g. LicenseServer): [unitylicenseserver.ec2.internal] unitylicenseserver
Do you want the licensing server to use HTTPS? [Y/n] n
List of available network interfaces on this host

  - [1] lo (00:00:00:00:00:00) 127.0.0.1
  - [2] eth0 (02:D4:86:51:CD:E0) 10.0.171.141
Enter the index number of the network interface which server will operate on: 2
Enter server's listening port number (between 1025 and 65535): [8080]
Add default addresses to the Admin IP Allowlist (127.0.0.1, ::1, 10.0.171.141)? [Y/n] y
List of current allow-listed admin IP addresses:
  - 127.0.0.1
  - ::1
  - 10.0.171.141
Add an additional admin IP address to the allow list? [y/N] n

Generating signing key... Done

Generating server configuration ...Done
Generating services configuration ...Done
Reloading configuration... Done
Generating server registration request file... Done

- - - -
Setup Completed!
- - - -
```

### セッションマネージャー経由での EC2 インスタンスへの接続方法

EC2 インスタンスへセッションマネージャー経由で接続する方法について記載します。
詳細は [公式ドキュメント](https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/session-manager.html) をご覧ください。

1. AWS マネジメントコンソールにアクセスし、「EC2」→ 「インスタンス」と遷移し、インスタンス一覧を表示します
2. 接続したいインスタンスを選択し、[接続]をクリックします
3. 「セッションマネージャー」タブが選択されていることを確認し、[接続] をクリックします
4. ssm-user ユーザーでターミナル画面が表示されていたら接続完了です

## Next Action

AMI 作成が完了した後は、以下の作業をおこなってください。

* AMI を利用したライセンスサーバーの起動
