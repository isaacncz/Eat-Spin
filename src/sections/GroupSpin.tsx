import { useEffect, useMemo, useState } from 'react';
import { Users, Link2, CheckCircle2, Sparkles, Trophy, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function GroupSpin() {
  const [roomCode, setRoomCode] = useState('');
  const [roomLink, setRoomLink] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [joinValue, setJoinValue] = useState('');
  const [joinedRoom, setJoinedRoom] = useState('');

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  }, []);

  const normalizeRoomCode = (value: string) => value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();

  const buildRoomLink = (code: string) => {
    if (!baseUrl) return `?room=${code}`;
    const url = new URL(baseUrl);
    url.searchParams.set('room', code);
    return url.toString();
  };

  const updateRoomState = (code: string) => {
    const normalized = normalizeRoomCode(code);
    if (!normalized) return;
    const nextLink = buildRoomLink(normalized);
    setRoomCode(normalized);
    setRoomLink(nextLink);
    setHasCopied(false);
    setJoinedRoom(normalized);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', normalized);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleCreateRoom = () => {
    updateRoomState(Math.random().toString(36).slice(2, 8));
  };

  const handleCopyLink = async () => {
    if (!roomLink || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(roomLink);
    setHasCopied(true);
  };

  const extractRoomCode = (value: string) => {
    if (value.includes('room=')) {
      try {
        return new URL(value).searchParams.get('room') ?? '';
      } catch {
        return value;
      }
    }
    return value;
  };

  const handleJoinRoom = () => {
    if (!joinValue.trim()) return;
    const code = extractRoomCode(joinValue);
    updateRoomState(code);
    setJoinValue('');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramRoom = params.get('room');
    if (paramRoom) {
      updateRoomState(paramRoom);
    }
  }, []);

  return (
    <section id="group-spin" className="py-16 px-4 sm:px-6 lg:px-8 bg-brand-linen">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Badge className="bg-brand-orange/10 text-brand-orange border border-brand-orange/30 mb-4">
            Flagship Feature
          </Badge>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-brand-black mb-4">
            Group Spin makes deciding effortless
          </h2>
          <p className="text-eatspin-gray-1 max-w-2xl mx-auto">
            Create a room, share the link, and spin together. Everyone sees the same result — even without
            realtime sync — so it feels magical every time.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-eatspin-peach/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-heading text-brand-black">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10">
                  <Users className="text-brand-orange" size={20} />
                </span>
                Create a room
              </CardTitle>
              <CardDescription>
                Start a private spin room in seconds and invite everyone to join.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-heading"
                onClick={handleCreateRoom}
              >
                Create room link
              </Button>
              <div className="rounded-xl border border-dashed border-brand-orange/30 bg-white/70 px-4 py-3 text-sm text-eatspin-gray-1">
                {roomCode ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-brand-black/60">Room code</p>
                    <p className="font-heading text-base text-brand-black">{roomCode}</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate text-xs text-brand-black/70">{roomLink}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                        onClick={handleCopyLink}
                      >
                        {hasCopied ? <Check size={16} /> : <Copy size={16} />}
                        {hasCopied ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  'Room code will appear here once created.'
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-eatspin-peach/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-heading text-brand-black">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10">
                  <Link2 className="text-brand-orange" size={20} />
                </span>
                Join the room
              </CardTitle>
              <CardDescription>
                Paste a room link or code and get ready to spin together.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Input
                placeholder="Paste room link or enter code"
                className="h-12 rounded-xl border-eatspin-peach/60 bg-white"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
              />
              <Button
                variant="outline"
                className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                onClick={handleJoinRoom}
              >
                Join room
              </Button>
            </CardContent>
          </Card>
        </div>

        {joinedRoom && (
          <div className="mt-10 rounded-2xl border border-brand-orange/30 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-black/60">Joined room</p>
                <p className="font-heading text-lg text-brand-black">{joinedRoom}</p>
                <p className="text-sm text-eatspin-gray-1">Invite others with your link or let them paste the code.</p>
              </div>
              {roomLink && (
                <Button
                  variant="outline"
                  className="border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                  onClick={handleCopyLink}
                >
                  {hasCopied ? <Check size={16} /> : <Copy size={16} />}
                  {hasCopied ? 'Copied' : 'Copy room link'}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <CheckCircle2 size={20} className="text-brand-orange" />,
              title: 'Everyone taps Ready',
              copy: 'See who is in, who is hungry, and when to start.',
            },
            {
              icon: <Sparkles size={20} className="text-brand-orange" />,
              title: 'Host (or anyone) spins',
              copy: 'One tap triggers a shared result across all devices.',
            },
            {
              icon: <Trophy size={20} className="text-brand-orange" />,
              title: 'Best of 3 mode',
              copy: 'Run three spins to settle debates with a clear winner.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl bg-white px-5 py-4 shadow-sm border border-eatspin-peach/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange/10">
                  {item.icon}
                </span>
                <p className="font-heading font-semibold text-brand-black">{item.title}</p>
              </div>
              <p className="text-sm text-eatspin-gray-1">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
