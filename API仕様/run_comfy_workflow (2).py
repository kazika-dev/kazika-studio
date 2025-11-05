#!/usr/bin/env python3
# -*- coding: utf-8 -*-


comfy_url="https://tensorboard-nwvrc71o98.clg07azjl.paperspacegradient.com"

"""
ComfyUI Workflow Runner
-----------------------
指定した ComfyUI ワークフロー(JSON) を ComfyUI API に投げて実行し、
生成物(画像/動画)を自動ダウンロードするスクリプト。

■ 使い方
1) ComfyUI を起動しておく（デフォルト: http://127.0.0.1:8188）
2) このスクリプトを保存し、実行権限を付与（必要なら）
3) 下記の例のように実行:
   python run_comfy_workflow.py --workflow /notebooks/ComfyUI/user/default/workflows/video_wan2_2_14B_i2v.json --out /notebooks/ComfyUI/output

※ workflow.json は ComfyUI でエクスポートした「ワークフローJSON」をそのまま渡せます。
   （LoadImage ノードなどで参照する画像は、ComfyUI 側の input/ に置くか、
     本スクリプトの --upload-image でアップロードしてください）

■ 主な機能
- /prompt にワークフローを投げる
- /history/{prompt_id} をポーリングして完了検知（または WebSocket で進捗購読）
- 出力ファイル名を取得し /view?filename=... からダウンロード
- 画像/動画とも自動保存
- client_id を自動生成（任意指定も可）
- 任意の画像を /upload/image にアップロード可能

依存:
- requests
- websocket-client（オプション: --ws を指定した場合に使用）

pip install requests websocket-client
"""

import argparse
import json
import os
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional

import requests

try:
    import websocket  # type: ignore
except Exception:
    websocket = None  # WebSocket未使用時は不要


def _join_url(host: str, *paths: str) -> str:
    host = host.rstrip('/')
    path = "/".join([p.strip('/') for p in paths])
    return f"{host}/{path}"


class ComfyUIClient:
    def __init__(
        self,
        host: str = comfy_url,
        client_id: Optional[str] = None,
        timeout: int = 30,
    ) -> None:
        self.host = host.rstrip("/")
        self.client_id = client_id or str(uuid.uuid4())
        self.session = requests.Session()
        self.session.timeout = timeout

    # ---------- Utility ----------
    def _get(self, path: str, **kwargs) -> requests.Response:
        url = _join_url(self.host, path)
        resp = self.session.get(url, **kwargs)
        resp.raise_for_status()
        return resp

    def _post(self, path: str, json_data: Dict[str, Any], **kwargs) -> requests.Response:
        url = _join_url(self.host, path)
        resp = self.session.post(url, json=json_data, **kwargs)
        resp.raise_for_status()
        return resp

    # ---------- File I/O with ComfyUI ----------
    def upload_image(self, image_path: str, dst_type: str = "input") -> str:
        """
        画像を ComfyUI にアップロード（/upload/image）。
        dst_type: "input" or "temp"
        戻り値: ComfyUI 内での保存ファイル名（例: "my.png"）
        """
        url = _join_url(self.host, "upload/image")
        files = {"image": open(image_path, "rb")}
        data = {"type": dst_type}
        r = self.session.post(url, files=files, data=data)
        r.raise_for_status()
        # レスポンス例: {"name": "my.png", "subfolder": "", "type": "input"}
        j = r.json()
        return j.get("name")

    # ---------- Prompt (workflow) ----------
    def queue_prompt(self, prompt: Dict[str, Any]) -> str:
        """
        /prompt に投げて prompt_id を返す。
        prompt は ComfyUI 標準の {"prompt": {...}, "client_id": "..."} 形式でも、
        ワークフローJSON単体でも OK。単体の場合はラップする。
        """
        if "prompt" in prompt and "client_id" in prompt:
            payload = prompt
        else:
            payload = {"prompt": prompt, "client_id": self.client_id}
        r = self._post("prompt", json_data=payload)
        j = r.json()
        # レスポンス例: {"prompt_id":"abc-123", "number":1, "node_errors":{}}
        return j.get("prompt_id")

    def get_history(self, prompt_id: str) -> Dict[str, Any]:
        r = self._get(f"history/{prompt_id}")
        return r.json()

    def get_object_info(self) -> Dict[str, Any]:
        r = self._get("object_info")
        return r.json()

    # ---------- Results ----------
    def download_files(self, outputs: Dict[str, Any], out_dir: str = "/notebooks/ComfyUI/output") -> List[str]:
        """
        /history の outputs からファイルをダウンロード。
        戻り値: 保存したローカルパスのリスト
        """
        os.makedirs(out_dir, exist_ok=True)
        saved: List[str] = []

        for node_id, node_out in outputs.items():
            for out in node_out.get("images", []):
                filename = out["filename"]
                subfolder = out.get("subfolder", "")
                type_ = out.get("type", "output")  # "output" or "temp" など
                # /view?filename=...&subfolder=...&type=...
                params = {"filename": filename}
                if subfolder: params["subfolder"] = subfolder
                if type_: params["type"] = type_
                resp = self._get("view", params=params, stream=True)

                local = Path(out_dir) / filename
                with open(local, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                saved.append(str(local))

            for out in node_out.get("videos", []):
                filename = out["filename"]
                subfolder = out.get("subfolder", "")
                type_ = out.get("type", "output")
                params = {"filename": filename}
                if subfolder: params["subfolder"] = subfolder
                if type_: params["type"] = type_
                resp = self._get("view", params=params, stream=True)

                local = Path(out_dir) / filename
                with open(local, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                saved.append(str(local))

        return saved

    # ---------- Progress (Polling) ----------
    def wait_done(self, prompt_id: str, poll_sec: float = 2.0, max_wait: int = 60*60) -> Dict[str, Any]:
        """
        /history をポーリングして完了まで待つ。
        完了後の /history 全体(JSON) を返す。
        """
        start = time.time()
        while True:
            hist = self.get_history(prompt_id)
            # /history の戻りは {"prompt_id":{...}} の形式
            if prompt_id in hist:
                data = hist[prompt_id]
                # data["status"]["completed"] が存在し True であれば完了
                status = data.get("status", {})
                if status.get("completed") is not None:
                    return hist

            if time.time() - start > max_wait:
                raise TimeoutError("Timeout waiting for ComfyUI prompt completion.")
            time.sleep(poll_sec)

    # ---------- Progress (WebSocket, optional) ----------
    def subscribe_ws(self, on_message=None):
        """
        WebSocketで進捗を受け取る（任意）。
        注意: websocket-client が必要。pip install websocket-client
        """
        if websocket is None:
            raise RuntimeError("websocket-client がインストールされていません。 pip install websocket-client")

        ws_url = self.host.replace("http", "ws")
        ws_url = _join_url(ws_url, "ws")
        ws_url += f"?clientId={self.client_id}"

        def _default_on_message(_, message):
            # ComfyUI から status, executing, executed などのメッセージが飛ぶ
            print("[WS]", message[:2000])

        ws = websocket.WebSocketApp(
            ws_url,
            on_message=(on_message or _default_on_message),
        )
        return ws


def load_workflow_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)
    # ワークフローエクスポートは {"last_node_id":..., "nodes":[...], ...} の形式が多い。
    # ComfyUI /prompt は「コンパイル済みグラフ形式」でも「ワークフロー形式」でも受け付けます。
    # そのまま送って動くことが多いですが、
    # 万一 "workflow" キーなど別ラップが必要なテンプレなら適宜ここで整形してください。
    return d


def main():
    parser = argparse.ArgumentParser(description="Send a ComfyUI workflow JSON and download outputs.")
    parser.add_argument("--host", default=os.environ.get("COMFY_HOST", comfy_url))
    parser.add_argument("--workflow", required=True, help="Path to workflow JSON exported from ComfyUI")
    parser.add_argument("--out", default="/notebooks/ComfyUI/output", help="Directory to save outputs")
    parser.add_argument("--client-id", default=None, help="Optional fixed client_id (otherwise random UUID)")
    parser.add_argument("--poll", action="store_true", help="Poll /history until completion (default)")
    parser.add_argument("--ws", action="store_true", help="Also open WebSocket to observe live progress")
    parser.add_argument("--upload-image", action="append", default=[],
                        help="Upload local image(s) to ComfyUI input/. Repeatable. Returns server-side file names.")
    args = parser.parse_args()

    client = ComfyUIClient(host=args.host, client_id=args.client_id)

    # (任意) 画像アップロード
    if args.upload_image:
        print("Uploading images:")
        for p in args.upload_image:
            name = client.upload_image(p, dst_type="input")
            print(f"  - {p} -> {name} (type=input)")
        print("※ LoadImage ノードのファイル名と一致しているか確認してください。")

    # ワークフローJSONをロード（ユーザのエクスポートそのままでOK）
    prompt_dict = load_workflow_json(args.workflow)

    # WebSocket購読（任意）
    ws = None
    if args.ws:
        ws = client.subscribe_ws()
        # 非同期で開始
        import threading
        t = threading.Thread(target=ws.run_forever, daemon=True)
        t.start()
        print(f"Opened WebSocket subscriber with client_id={client.client_id}")

    # 投入
    print("Queueing prompt ...")
    prompt_id = client.queue_prompt(prompt_dict)
    print(f"prompt_id: {prompt_id}  client_id: {client.client_id}")

    # 完了待ち
    hist = client.wait_done(prompt_id, poll_sec=2.0) if args.poll or not args.ws else client.get_history(prompt_id)

    # 出力のダウンロード
    data = hist[prompt_id]
    outputs = data.get("outputs", {})
    saved = client.download_files(outputs, out_dir=args.out)

    print("\nSaved files:")
    for s in saved:
        print(" -", s)

    print("\nDone.")


if __name__ == "__main__":
    main()
