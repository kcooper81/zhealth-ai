import { promises as fs } from "fs";
import path from "path";
import type { Conversation } from "./types";

const DATA_DIR = path.join(process.cwd(), "src", "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readConversationsFile(): Promise<Conversation[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(CONVERSATIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    await fs.writeFile(CONVERSATIONS_FILE, "[]", "utf-8");
    return [];
  }
}

async function writeConversationsFile(
  conversations: Conversation[]
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(
    CONVERSATIONS_FILE,
    JSON.stringify(conversations, null, 2),
    "utf-8"
  );
}

export async function listConversations(): Promise<Conversation[]> {
  const conversations = await readConversationsFile();
  return conversations
    .map((c) => ({
      ...c,
      messages: [],
    }))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export async function getConversation(
  id: string
): Promise<Conversation | null> {
  const conversations = await readConversationsFile();
  return conversations.find((c) => c.id === id) || null;
}

export async function createConversation(
  title?: string,
  pageContextId?: number
): Promise<Conversation> {
  const conversations = await readConversationsFile();
  const now = new Date().toISOString();

  const conversation: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    title: title || "New conversation",
    messages: [],
    pageContextId,
    createdAt: now,
    updatedAt: now,
  };

  conversations.push(conversation);
  await writeConversationsFile(conversations);
  return conversation;
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, "title" | "messages" | "pageContextId">>
): Promise<Conversation | null> {
  const conversations = await readConversationsFile();
  const index = conversations.findIndex((c) => c.id === id);

  if (index === -1) {
    return null;
  }

  conversations[index] = {
    ...conversations[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await writeConversationsFile(conversations);
  return conversations[index];
}

export async function deleteConversation(id: string): Promise<boolean> {
  const conversations = await readConversationsFile();
  const index = conversations.findIndex((c) => c.id === id);

  if (index === -1) {
    return false;
  }

  conversations.splice(index, 1);
  await writeConversationsFile(conversations);
  return true;
}
