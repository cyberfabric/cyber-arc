---
id: <required: identifer>
type: <optional for overlay: middleware | skill | agent | rules | workflow>
name: <optional for overlay: name>
description: <optional for overlay: description>
<required for middleware>target_types: rules, skill>
<required for middleware>timing: pre | post>
---

<!-- append "<new-id>" -->
<content>
<!-- /append -->

<!-- insert "<new-id>" before="<existing-id>" -->
<content>
<!-- /insert -->

<!-- append "<new-id>" after="<existing-id>" -->
<content>
<!-- /append -->

<!-- replace "<existing-id>" -->
<content>
<!-- /replace -->