'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SidebarTrigger } from './ui/sidebar.js';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu.js';
import { ConfirmDialog } from './ui/confirm-dialog.js';
import { RenameDialog } from './ui/rename-dialog.jsx';
import { ChevronDownIcon, StarIcon, StarFilledIcon, PencilIcon, TrashIcon, AgentIcon, CodeIcon } from './icons.js';
import { renameChat, deleteChat, starChat } from '../actions.js';
import { useChatNav } from './chat-nav-context.js';
import { ModelPicker } from './model-picker.jsx';

export function ChatHeader({ chatId: chatIdProp, workspaceId }) {
  const [title, setTitle] = useState(null);
  const [starred, setStarred] = useState(0);
  const [resolvedChatId, setResolvedChatId] = useState(chatIdProp || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [chatMode, setChatMode] = useState(workspaceId ? 'code' : null);
  const inputRef = useRef(null);
  const nav = useChatNav();
  const TitleIcon = chatMode === 'code' ? CodeIcon : AgentIcon;

  const chatId = resolvedChatId;
  const showControls = chatId && title && title !== 'New Chat';

  const fetchMeta = useCallback(() => {
    if (workspaceId) {
      fetch(`/code/${workspaceId}/chat-data`)
        .then(r => r.json())
        .then((data) => {
          if (data?.title && data.title !== 'New Chat') {
            setTitle(data.title);
            setStarred(data.starred || 0);
            setResolvedChatId(data.chatId);
            if (data.chatMode) setChatMode(data.chatMode);
            document.title = data.title;
          }
        })
        .catch(() => {});
      return;
    }
    if (!chatIdProp) return;
    fetch(`/chat/${chatIdProp}/data`)
      .then(r => r.json())
      .then((data) => {
        if (data?.title && data.title !== 'New Chat') {
          setTitle(data.title);
          setStarred(data.starred || 0);
          if (data.chatMode) setChatMode(data.chatMode);
          document.title = data.title;
        }
      })
      .catch(() => {});
  }, [chatIdProp, workspaceId]);

  useEffect(() => {
    fetchMeta();
    const titleHandler = () => fetchMeta();
    window.addEventListener('chat-title-updated', titleHandler);
    return () => window.removeEventListener('chat-title-updated', titleHandler);
  }, [fetchMeta]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const enterEditMode = () => {
    setEditValue(title || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const saveEdit = async () => {
    const next = editValue.trim();
    if (!next || !chatId || next === title) {
      cancelEdit();
      return;
    }
    const result = await renameChat(chatId, next);
    if (!result?.error) {
      setTitle(next);
      document.title = next;
      window.dispatchEvent(new Event('chat-title-updated'));
    }
    setIsEditing(false);
  };

  const handleRenameFromDialog = async (next) => {
    if (!chatId || !next?.trim()) return;
    const result = await renameChat(chatId, next.trim());
    if (!result?.error) {
      setTitle(next.trim());
      document.title = next.trim();
      window.dispatchEvent(new Event('chat-title-updated'));
    }
    setShowRenameDialog(false);
  };

  const handleStar = async () => {
    if (!chatId) return;
    const next = starred ? 0 : 1;
    const result = await starChat(chatId, next);
    if (!result?.error) setStarred(next);
  };

  const handleDelete = async () => {
    if (!chatId) return;
    const result = await deleteChat(chatId);
    setShowDeleteConfirm(false);
    if (!result?.error) {
      if (nav?.navigate) nav.navigate('/chat');
      else window.location.href = '/chat';
    }
  };

  return (
    <>
      <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2 z-10 min-w-0">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={saveEdit}
            className="text-base font-medium text-foreground bg-background rounded-md border border-ring px-2 py-0.5 outline-none ring-2 ring-ring/30 min-w-0 w-full"
          />
        ) : showControls ? (
          <div className="group/title flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted transition-colors min-w-0">
            {chatMode && (
              <span className="text-muted-foreground shrink-0">
                <TitleIcon size={16} />
              </span>
            )}
            <h1
              className="text-base font-medium text-muted-foreground truncate cursor-pointer"
              onClick={enterEditMode}
            >
              {title}
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground shrink-0">
                  <ChevronDownIcon size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[150px]">
                <DropdownMenuItem onClick={handleStar}>
                  {starred ? <StarFilledIcon size={14} /> : <StarIcon size={14} />}
                  <span>{starred ? 'Unstar' : 'Star'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowRenameDialog(true)}>
                  <PencilIcon size={14} />
                  <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)}>
                  <TrashIcon size={14} />
                  <span className="text-destructive">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-1 min-w-0">
            {title && chatMode && (
              <span className="text-muted-foreground shrink-0">
                <TitleIcon size={16} />
              </span>
            )}
            <h1 className="text-base font-medium text-muted-foreground truncate">
              {title || '\u00A0'}
            </h1>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <ModelPicker />
        </div>
      </header>

      <RenameDialog
        open={showRenameDialog}
        onSave={handleRenameFromDialog}
        onCancel={() => setShowRenameDialog(false)}
        title="Rename chat"
        currentValue={title || ''}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete chat?"
        description="This will permanently delete this chat and all its messages."
        confirmLabel="Delete"
      />
    </>
  );
}
