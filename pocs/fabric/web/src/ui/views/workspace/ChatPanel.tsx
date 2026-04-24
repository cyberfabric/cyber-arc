import { useEffect, useRef } from 'react';
import fabric from '../../../fabricLib';
import type { ChatMessage, ChatAgent, WorkspaceFile } from '../../../types';
import { cannedResponse } from './canned';

interface Props {
  messages: ChatMessage[];
  agent: ChatAgent;
  input: string;
  activeFile: WorkspaceFile | null;
  onChangeAgent: (a: ChatAgent) => void;
  onChangeInput: (v: string) => void;
}

export default function ChatPanel(props: Props): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [props.messages.length]);

  const send = (): void => {
    const text = props.input.trim();
    if (!text) return;
    const now = Date.now();
    const filePath = props.activeFile?.path;
    fabric.workspaces.pushChatMessage({
      id: `u-${now}`,
      role: 'user',
      text,
      timestamp: now,
      fileContext: filePath,
    });
    fabric.workspaces.setChatInput('');
    // Artificial delay, then push canned agent reply.
    const agent = props.agent;
    const file = props.activeFile;
    setTimeout(() => {
      fabric.workspaces.pushChatMessage({
        id: `a-${Date.now()}`,
        role: 'agent',
        agent,
        text: cannedResponse(agent, file),
        timestamp: Date.now(),
        fileContext: filePath,
      });
    }, 400);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="ws-chat">
      <header className="ws-chat__head">
        <span className="ws-chat__title">💬 Chat</span>
        <label className="ws-chat__agent">
          Agent:
          <select
            value={props.agent}
            onChange={(e) => props.onChangeAgent(e.target.value as ChatAgent)}
          >
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
          </select>
        </label>
      </header>
      <div ref={listRef} className="ws-chat__list">
        {props.messages.length === 0 && (
          <div className="ws-chat__empty">Ask the agent about the open file.</div>
        )}
        {props.messages.map((m) => (
          <div key={m.id} className={`ws-chat__msg ws-chat__msg--${m.role}`}>
            <div className="ws-chat__who">{m.role === 'user' ? 'you' : (m.agent ?? 'agent')}</div>
            <div className="ws-chat__text">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="ws-chat__input-row">
        <textarea
          className="ws-chat__input"
          placeholder="Ask about the open file… (Enter to send, Shift+Enter for newline)"
          value={props.input}
          onChange={(e) => props.onChangeInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
        />
        <button type="button" className="ws-chat__send" onClick={send}>Send</button>
      </div>
    </div>
  );
}
