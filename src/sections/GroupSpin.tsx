import { Users, Link2, CheckCircle2, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function GroupSpin() {
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
              <Button className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-heading">
                Create room link
              </Button>
              <div className="rounded-xl border border-dashed border-brand-orange/30 bg-white/70 px-4 py-3 text-sm text-eatspin-gray-1">
                Room code will appear here once created.
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
              />
              <Button variant="outline" className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange/10">
                Join room
              </Button>
            </CardContent>
          </Card>
        </div>

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
