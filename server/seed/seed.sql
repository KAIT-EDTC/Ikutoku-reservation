-- ローカル確認用のコマ（ID 9000番台）と予約。受付期間の初日・2日目に、体験ごとに数コマずつ作る。
-- 何度実行しても同じ状態になる（npm run db:seed が先に clear.sql を流す）
INSERT INTO slots (id, date, product, start_time, end_time, capacity) VALUES
  (9001, (SELECT open_date FROM settings), 'programming', '10:00', '10:30', 6),
  (9002, (SELECT open_date FROM settings), 'programming', '11:00', '11:30', 6),
  (9003, (SELECT open_date FROM settings), 'programming', '13:00', '13:30', 6),
  (9004, (SELECT open_date FROM settings), 'buruburu', '10:30', '11:30', 5),
  (9005, (SELECT open_date FROM settings), 'buruburu', '13:30', '14:30', 3),
  (9006, (SELECT open_date FROM settings), 'sumo', '11:00', '12:00', 4),
  (9007, (SELECT open_date FROM settings), 'sumo', '14:00', '15:00', 4),
  (9008, (SELECT date(open_date, '+1 day') FROM settings), 'programming', '10:00', '10:30', 6),
  (9009, (SELECT date(open_date, '+1 day') FROM settings), 'programming', '11:00', '11:30', 6),
  (9010, (SELECT date(open_date, '+1 day') FROM settings), 'buruburu', '10:30', '11:30', 5),
  (9011, (SELECT date(open_date, '+1 day') FROM settings), 'sumo', '13:00', '14:00', 4);
INSERT INTO reservations (slot_id, people, code, created_at, created_by_type, created_by_id) VALUES
  (9002, 2, 'SD2A', datetime('now', '+9 hours'), 'admin', 0),
  (9005, 2, 'SD4B', datetime('now', '+9 hours'), 'admin', 0),
  (9006, 4, 'SD6C', datetime('now', '+9 hours'), 'admin', 0);
