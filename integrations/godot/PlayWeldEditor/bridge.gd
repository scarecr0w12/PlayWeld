# SPDX-License-Identifier: Apache-2.0
@tool
extends EditorPlugin

var _server := TCPServer.new()
var _clients: Array[Dictionary] = []
var _token := ""
var _session := ""
var _project := ""
var _native_project := ""

func _enter_tree() -> void:
	_project = ProjectSettings.globalize_path("res://").trim_suffix("/")
	_native_project = _project
	var credential := ProjectSettings.globalize_path("res://.godot/PlayWeldEditor/session-token.dpapi")
	if OS.get_name() == "Linux" and not OS.get_environment("WSL_DISTRO_NAME").is_empty():
		var converted: Array = []
		if OS.execute("wslpath", ["-w", _project], converted) != 0 or converted.size() != 1:
			return
		_native_project = str(converted[0]).strip_edges()
		credential = _native_project.path_join(".godot/PlayWeldEditor/session-token.dpapi")
	elif OS.get_name() != "Windows":
		push_warning("PlayWeld pairing requires its installed Windows protected credential.")
		return
	if not FileAccess.file_exists("res://.godot/PlayWeldEditor/session-token.dpapi"):
		return
	var script := "Add-Type -AssemblyName System.Security;$v=[IO.File]::ReadAllBytes('" + credential.replace("'", "''") + "');$r=[Security.Cryptography.ProtectedData]::Unprotect($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Text.Encoding]::UTF8.GetString($r));[Array]::Clear($r,0,$r.Length)"
	var output: Array = []
	var encoded := Marshalls.raw_to_base64(script.to_utf16_buffer())
	var code := OS.execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], output, false, false)
	if code != 0 or output.size() != 1:
		push_error("PlayWeld credential helper failed (exit %d, output blocks %d); reinstall pairing from PlayWeld." % [code, output.size()])
		return
	_token = str(output[0]).strip_edges()
	if _token.length() != 64 or not _token.is_valid_hex_number(false):
		_token = ""
		return
	var port := 0
	for attempt in range(32):
		port = randi_range(49152, 65535)
		if _server.listen(port, "127.0.0.1") == OK:
			break
	if not _server.is_listening():
		_token = ""
		return
	_session = ProjectSettings.globalize_path("res://.godot/PlayWeldEditor/session.json")
	var file := FileAccess.open(_session, FileAccess.WRITE)
	file.store_string(JSON.stringify({"bridge": "PlayWeldEditor", "pid": OS.get_process_id(), "projectPath": _native_project.path_join("project.godot"), "url": "http://127.0.0.1:%d/mcp" % port}))
	set_process(true)

func _exit_tree() -> void:
	_server.stop()
	for client in _clients:
		client.peer.disconnect_from_host()
	_clients.clear()
	_token = ""
	if not _session.is_empty():
		DirAccess.remove_absolute(_session)

func _process(_delta: float) -> void:
	while _server.is_connection_available():
		var peer := _server.take_connection()
		if _clients.size() >= 8:
			peer.disconnect_from_host()
		else:
			_clients.append({"peer": peer, "data": PackedByteArray(), "started": Time.get_ticks_msec()})
	for index in range(_clients.size() - 1, -1, -1):
		var client := _clients[index]
		var peer: StreamPeerTCP = client.peer
		peer.poll()
		if peer.get_status() != StreamPeerTCP.STATUS_CONNECTED or Time.get_ticks_msec() - int(client.started) > 3000:
			peer.disconnect_from_host()
			_clients.remove_at(index)
			continue
		var available := peer.get_available_bytes()
		if available > 0:
			if client.data.size() + available > 1048576 + 8192:
				_reply(peer, 400, {})
				_clients.remove_at(index)
				continue
			client.data.append_array(peer.get_data(available)[1])
		var bytes: PackedByteArray = client.data
		var text := bytes.get_string_from_utf8()
		var split := text.find("\r\n\r\n")
		if split == -1:
			if bytes.size() > 8192:
				_reply(peer, 400, {})
				_clients.remove_at(index)
			continue
		var headers := text.substr(0, split).split("\r\n")
		if headers[0] != "POST /mcp HTTP/1.1":
			_reply(peer, 405, {})
			_clients.remove_at(index)
			continue
		var length := -1
		var authorization := ""
		var invalid := split > 8192
		for line in headers:
			var colon: int = line.find(":")
			if colon < 0:
				continue
			var key: String = line.substr(0, colon).to_lower()
			var value: String = line.substr(colon + 1).strip_edges()
			if key == "origin" or key == "transfer-encoding":
				invalid = true
			if key == "authorization":
				invalid = invalid or not authorization.is_empty()
				authorization = value
			if key == "content-length":
				invalid = invalid or length != -1 or not value.is_valid_int()
				length = value.to_int()
		if invalid or length < 0 or length > 1048576:
			_reply(peer, 400, {})
			_clients.remove_at(index)
			continue
		if bytes.size() < split + 4 + length:
			continue
		_clients.remove_at(index)
		if headers[0] != "POST /mcp HTTP/1.1":
			_reply(peer, 405, {})
		elif not _authorized(authorization):
			_reply(peer, 401, {})
		else:
			var request: Variant = JSON.parse_string(bytes.slice(split + 4, split + 4 + length).get_string_from_utf8())
			if not request is Dictionary:
				_reply(peer, 400, {})
			elif not request.has("id"):
				_reply(peer, 202, {})
			else:
				var response: Variant = _execute(request)
				var envelope := {"jsonrpc": "2.0", "id": request.id}
				if response == null:
					envelope.error = {"code": -32602, "message": "Editor operation rejected"}
				else:
					envelope.result = response
				_reply(peer, 200, envelope)

func _authorized(value: String) -> bool:
	var expected := "Bearer " + _token
	if _token.is_empty() or value.length() != expected.length():
		return false
	var difference := 0
	for index in range(value.length()):
		difference |= value.unicode_at(index) ^ expected.unicode_at(index)
	return difference == 0

func _reply(peer: StreamPeerTCP, status: int, result: Dictionary) -> void:
	var body := JSON.stringify(result).to_utf8_buffer() if status != 202 else PackedByteArray()
	var header := "HTTP/1.1 %d Response\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: %d\r\n\r\n" % [status, body.size()]
	peer.put_data(header.to_ascii_buffer())
	peer.put_data(body)
	peer.disconnect_from_host()

func _identity() -> Dictionary:
	var root := EditorInterface.get_edited_scene_root()
	var objects: Array = []
	if root != null:
		for child in root.get_children():
			if objects.size() >= 2000:
				break
			if child is Node3D:
				objects.append({"objectId": str(root.get_path_to(child)), "name": child.name, "owned": child.get_meta("playweld_owned", false), "location": [child.position.x, child.position.y, child.position.z]})
	return {"projectPath": _native_project.path_join("project.godot"), "engineVersion": Engine.get_version_info().string, "scene": root.scene_file_path if root != null else "", "objects": objects}

func _execute(request: Dictionary) -> Variant:
	var method: String = request.get("method", "")
	if method == "initialize":
		return {"protocolVersion": "2025-11-25", "capabilities": {"tools": {}}, "serverInfo": {"name": "playweld-godot-editor", "version": "0.1.0"}}
	if method == "ping":
		return {}
	if method == "tools/list":
		var tools: Array = []
		for name in ["get_project_context", "inspect", "edit_scene", "screenshot"]:
			var schema := {"type": "object", "properties": {}, "additionalProperties": false}
			if name == "edit_scene":
				schema.properties = {"action": {"type": "string", "enum": ["spawn", "set-location", "delete"]}, "objectId": {"type": "string"}, "location": {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3}}
				schema.required = ["action"]
			tools.append({"name": name, "description": "PlayWeld owned editor scene operation; edits support Undo.", "inputSchema": schema, "annotations": {"readOnlyHint": name in ["get_project_context", "inspect"], "destructiveHint": false}})
		return {"tools": tools}
	if method != "tools/call" or not request.get("params") is Dictionary:
		return null
	var params: Dictionary = request.params
	var name: String = params.get("name", "")
	var data := _identity()
	if name == "edit_scene":
		var root := EditorInterface.get_edited_scene_root()
		if root == null or not params.get("arguments") is Dictionary:
			return null
		var args: Dictionary = params.arguments
		var location: Variant = args.get("location", [0, 0, 0])
		if not location is Array or location.size() != 3:
			return null
		for number in location:
			if not (number is int or number is float) or not is_finite(float(number)) or abs(float(number)) > 10000000:
				return null
		var position := Vector3(location[0], location[1], location[2])
		var undo := get_undo_redo()
		var action: String = args.get("action", "")
		if action == "spawn":
			var node := Node3D.new()
			node.name = "PlayWeld_" + str(Time.get_ticks_usec())
			node.set_meta("playweld_owned", true)
			node.position = position
			undo.create_action("PlayWeld create node", UndoRedo.MERGE_DISABLE, root)
			undo.add_do_method(root, "add_child", node)
			undo.add_do_property(node, "owner", root)
			undo.add_undo_method(root, "remove_child", node)
			undo.add_do_reference(node)
			undo.commit_action()
		else:
			var node: Node = root.get_node_or_null(str(args.get("objectId", "")))
			if not node is Node3D or node.get_parent() != root or not node.get_meta("playweld_owned", false):
				return null
			if action == "set-location":
				undo.create_action("PlayWeld move node", UndoRedo.MERGE_DISABLE, root)
				undo.add_do_property(node, "position", position)
				undo.add_undo_property(node, "position", node.position)
			elif action == "delete":
				undo.create_action("PlayWeld delete node", UndoRedo.MERGE_DISABLE, root)
				undo.add_do_method(root, "remove_child", node)
				undo.add_undo_method(root, "add_child", node)
				undo.add_undo_property(node, "owner", root)
				undo.add_undo_reference(node)
			else:
				return null
			undo.commit_action()
		EditorInterface.mark_scene_as_unsaved()
		data = _identity()
	elif name == "screenshot":
		var viewport := EditorInterface.get_editor_viewport_3d(0)
		if viewport == null:
			return null
		var image := viewport.get_texture().get_image()
		if image == null or image.is_empty():
			return null
		var file := _project.path_join(".godot/PlayWeldEditor/viewport-%d.png" % Time.get_ticks_usec())
		if image.save_png(file) != OK:
			return null
		data.screenshot = file
	elif name not in ["get_project_context", "inspect"]:
		return null
	return {"content": [{"type": "text", "text": JSON.stringify(data)}], "structuredContent": data, "isError": false}
