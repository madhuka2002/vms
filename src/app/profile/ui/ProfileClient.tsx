'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, User } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type DisplayNameInfo = {
  displayName: string | null;
  canUpdate: boolean;
  isAdmin: boolean;
  lastUpdateTime: string | null;
  nextUpdateTime: string | null;
};

export default function ProfileClient() {
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: displayNameInfo, mutate } = useSWR<DisplayNameInfo>(
    '/api/profile/display-name',
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: meData } = useSWR<any>('/api/me', fetcher);

  // ---------- HEX HELPERS ----------
  const hexHeight = (w: number) => (Math.sqrt(3) / 2) * w;

  // (col,row) -> pixel coordinates for flat-topped staggered hex grid
  const gridToPixel = (col: number, row: number, w: number, spacing: number) => {
    const h = hexHeight(w);
    const dx = 0.75 * w + spacing;
    const dy = h + spacing;
    const x = col * dx;
    const y = row * dy + (col % 2 ? dy / 2 : 0); // stagger odd columns
    return { x, y, h };
  };
  // ---------------------------------

  useEffect(() => {
    if (displayNameInfo?.displayName) setNewDisplayName(displayNameInfo.displayName);
  }, [displayNameInfo]);

  const handleUpdateDisplayName = async () => {
    const trimmed = newDisplayName.trim();
    if (!trimmed) return setMessage({ type: 'error', text: 'Please enter a display name' });
    if (trimmed.includes(' '))
      return setMessage({ type: 'error', text: 'Display name cannot contain spaces' });
    if (trimmed.length < 2)
      return setMessage({ type: 'error', text: 'Display name must be at least 2 characters long' });
    if (trimmed.length > 16)
      return setMessage({ type: 'error', text: 'Display name must be 16 characters or less' });

    setIsUpdating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const result = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: result.message || 'Display name updated successfully!' });
        mutate();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update display name' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatTimeUntilNextUpdate = (nextUpdateTime: string) => {
    const now = new Date();
    const next = new Date(nextUpdateTime);
    const diff = next.getTime() - now.getTime();
    if (diff <= 0) return 'Available now';
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const cardChrome = 'bg-transparent border-2 border-[#A5D8FF] rounded-none text-white';

  // -------------------- BADGE LAYOUT --------------------
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const SPACING = 4; // reduced spacing for more compact layout
  const BORDER = '1px solid rgba(255,255,255,0.5)';

  // scale badge size to fit inside container
  const BADGE_W = useMemo(() => {
    if (containerW <= 0) return 45;
    const count = (meData?.me?.badges || []).length;

    // target columns based on count - increased column count
    let cols = 4;
    if (count > 8) cols = 5;
    if (count > 15) cols = 6;
    if (count > 25) cols = 7;
    if (count > 35) cols = 8;

    const stepX = containerW / cols;
    const w = (stepX - SPACING) / 0.75;
    return Math.max(28, Math.min(60, w)); // smaller clamp range
  }, [containerW, meData?.me?.badges]);

  const stepX = 0.75 * BADGE_W + SPACING;
  const stepY = hexHeight(BADGE_W) + SPACING;

  const colsThatFit = useMemo(() => {
    if (containerW <= 0) return 1;
    return Math.max(1, Math.floor((containerW - BADGE_W) / stepX) + 1);
  }, [containerW, BADGE_W, stepX]);

  const indexToCR = (i: number) => {
    const col = i % colsThatFit;
    const row = Math.floor(i / colsThatFit);
    return { col, row };
  };

  const computeWallHeight = (count: number) => {
    if (count === 0) return 0;
    const rows = Math.ceil(count / colsThatFit);
    return rows * stepY + stepY / 2;
  };
  // ------------------------------------------------------

  return (
    <div className="grid gap-4">
      {/* Display Name Section */}
      <Card className={cardChrome}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Display Name Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Current Display Name</label>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">New Display Name</label>
            <Input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Enter new display name"
              className="bg-transparent border-2 border-[#A5D8FF] rounded-none text-white"
              disabled={!displayNameInfo?.canUpdate}
            />
            <p className="text-xs text-muted-foreground">Display name can be updated anytime</p>
          </div>

          {!displayNameInfo?.canUpdate && displayNameInfo?.nextUpdateTime && (
            <Alert className="bg-yellow-900/20 border-yellow-400">
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-yellow-200">
                Display name can be updated again in:{' '}
                {formatTimeUntilNextUpdate(displayNameInfo.nextUpdateTime)}
              </AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert
              className={
                message.type === 'success'
                  ? 'bg-green-900/20 border-green-400'
                  : 'bg-red-900/20 border-red-400'
              }
            >
              <AlertDescription
                className={message.type === 'success' ? 'text-green-200' : 'text-red-200'}
              >
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleUpdateDisplayName}
            disabled={
              !displayNameInfo?.canUpdate ||
              isUpdating ||
              !newDisplayName.trim() ||
              newDisplayName.trim().includes(' ') ||
              newDisplayName.trim().length < 2 ||
              newDisplayName.trim().length > 16
            }
            className="w-full bg-[#A5D8FF] hover:bg-[#A5D8FF] text-black rounded-none cursor-pointer text-lg"
          >
            {isUpdating ? 'Updating...' : 'Update Display Name'}
          </Button>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card className={cardChrome}>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent className="p-2 ">
          {(() => {
            const icons = (meData?.me?.badges || [])
              .map((b: any) => b?.icon)
              .filter(Boolean) as string[];

            if (!icons.length) {
              return <p className="text-sm text-muted-foreground">No badges earned yet</p>;
            }

            const wallH = computeWallHeight(icons.length);
            const HEX_POLY =
              'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

            return (
              <div ref={containerRef} className="w-full">
                <div className="relative w-full" style={{ height: `${wallH}px` }}>
                  {icons.map((src, i) => {
                    const { col, row } = indexToCR(i);
                    const { x, y } = gridToPixel(col, row, BADGE_W, SPACING);
                    const H = hexHeight(BADGE_W);

                    return (
                      <div
                        key={`badge-${i}`}
                        className="absolute"
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          width: `${BADGE_W}px`,
                          height: `${H}px`,
                        }}
                      >
                        <div
                          className="relative overflow-hidden"
                          style={{
                            width: '100%',
                            height: '100%',
                            clipPath: HEX_POLY as any,
                            border: BORDER,
                          }}
                        >
                          <img
                            src={src}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover select-none"
                            draggable={false}
                            loading="lazy"
                            style={{ transform: 'scale(1.002)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
