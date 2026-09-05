import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.api.websocket import ConnectionManager, broadcast_loop
from app.models.job import DownloadMode, Job


class TestConnectionManager:
    @pytest.mark.asyncio
    async def test_connect_disconnect(self):
        manager = ConnectionManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws)
        assert len(manager.active) == 1
        mock_ws.accept.assert_called_once()

        manager.disconnect(mock_ws)
        assert len(manager.active) == 0

    @pytest.mark.asyncio
    async def test_broadcast(self):
        manager = ConnectionManager()
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()

        await manager.connect(mock_ws1)
        await manager.connect(mock_ws2)

        jobs = [
            Job(id="1", url="https://youtube.com/watch?v=1", mode=DownloadMode.AUDIO),
            Job(id="2", url="https://youtube.com/watch?v=2", mode=DownloadMode.VIDEO),
        ]

        await manager.broadcast(jobs)

        mock_ws1.send_json.assert_called_once()
        mock_ws2.send_json.assert_called_once()

        sent_data = mock_ws1.send_json.call_args[0][0]
        assert len(sent_data) == 2
        assert sent_data[0]["id"] == "1"

    @pytest.mark.asyncio
    async def test_broadcast_removes_dead_connections(self):
        manager = ConnectionManager()
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        mock_ws2.send_json.side_effect = Exception("Connection lost")

        await manager.connect(mock_ws1)
        await manager.connect(mock_ws2)

        jobs = [Job(id="1", url="https://youtube.com/watch?v=1", mode=DownloadMode.AUDIO)]

        await manager.broadcast(jobs)

        assert len(manager.active) == 1
        assert mock_ws1 in manager.active
        assert mock_ws2 not in manager.active


class TestBroadcastLoop:
    @pytest.mark.asyncio
    async def test_broadcast_loop_sends_updates(self):
        with patch("app.api.websocket.job_queue") as mock_queue:
            mock_queue.list_all = AsyncMock()

            job1 = Job(id="1", url="https://youtube.com/watch?v=1", mode=DownloadMode.AUDIO)
            job2 = Job(id="2", url="https://youtube.com/watch?v=2", mode=DownloadMode.VIDEO)

            call_count = [0]

            async def mock_list_all():
                call_count[0] += 1
                if call_count[0] == 1:
                    return [job1]
                elif call_count[0] == 2:
                    return [job1, job2]
                else:
                    raise asyncio.CancelledError()

            mock_queue.list_all.side_effect = mock_list_all

            with patch(
                "app.api.websocket.manager.broadcast", new_callable=AsyncMock
            ) as mock_broadcast:
                try:
                    await broadcast_loop()
                except asyncio.CancelledError:
                    pass

                assert mock_broadcast.call_count == 2

                first_call = mock_broadcast.call_args_list[0][0][0]
                assert len(first_call) == 1
                assert first_call[0].id == "1"

                second_call = mock_broadcast.call_args_list[1][0][0]
                assert len(second_call) == 2
