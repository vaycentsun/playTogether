/// <reference types="vite/client" />

type RoomState = 'idle' | 'starting' | 'connected' | 'error';

type Member = {
  id: string;
  name: string;
  role: 'host' | 'guest';
  ip: string;
  isSelf: boolean;
  route: string;
  latency: string;
  loss: string;
};

type RoomStatus = {
  state: RoomState;
  isHost: boolean;
  playerName: string;
  inviteCode: string;
  virtualIp: string;
  members: Member[];
  lastError: string;
};

type CoreInfo = {
  platform: string;
  supported: boolean;
  peer: string;
  running: boolean;
};

type PlayTogetherApi = {
  createRoom(playerName: string): Promise<RoomStatus>;
  joinRoom(inviteCode: string, playerName: string): Promise<RoomStatus>;
  leaveRoom(): Promise<RoomStatus>;
  getRoomStatus(): Promise<RoomStatus>;
  onRoomStatus(callback: (status: RoomStatus) => void): () => void;
  selectGame(): Promise<string>;
  detectGame(): Promise<string>;
  getGamePath(): Promise<string>;
  launchGame(): Promise<void>;
  getCoreInfo(): Promise<CoreInfo>;
};

interface Window {
  playTogether: PlayTogetherApi;
}
