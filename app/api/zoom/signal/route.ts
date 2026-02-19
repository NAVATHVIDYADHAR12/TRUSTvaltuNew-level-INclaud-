// WebRTC Signaling API — in-memory store (works in dev; use Redis/Vercel KV for production)

interface RoomSignal {
    offer: RTCSessionDescriptionInit | null;
    answer: RTCSessionDescriptionInit | null;
    offerCandidates: RTCIceCandidateInit[];
    answerCandidates: RTCIceCandidateInit[];
}

// Module-level Map persists across requests in the same Node.js process
const rooms = new Map<string, RoomSignal>();

function getRoom(roomId: string): RoomSignal {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            offer: null,
            answer: null,
            offerCandidates: [],
            answerCandidates: [],
        });
    }
    return rooms.get(roomId)!;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    if (!roomId) {
        return Response.json({ error: 'roomId is required' }, { status: 400 });
    }
    return Response.json(getRoom(roomId));
}

export async function POST(request: Request) {
    const body = await request.json();
    const { roomId, type, data } = body;

    if (!roomId || !type || data === undefined) {
        return Response.json({ error: 'roomId, type, and data are required' }, { status: 400 });
    }

    const room = getRoom(roomId);

    switch (type) {
        case 'offer':
            room.offer = data;
            break;
        case 'answer':
            room.answer = data;
            break;
        case 'offerCandidate':
            room.offerCandidates.push(data);
            break;
        case 'answerCandidate':
            room.answerCandidates.push(data);
            break;
        default:
            return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    return Response.json({ success: true });
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    if (roomId) {
        rooms.delete(roomId);
    }
    return Response.json({ success: true });
}
