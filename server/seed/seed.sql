-- ローカル確認用のコマ（ID 9000番台）と予約。受付期間の初日・2日目に 10:00〜15:00 の4コマずつ作る。
-- 何度実行しても同じ状態になる（npm run db:seed が先に clear.sql を流す）
INSERT INTO slot_templates (id, weekday, start_time, end_time, capacity) VALUES
  (9001, 6, '10:00', '11:00', 8), (9002, 6, '11:00', '12:00', 8), (9003, 0, '13:00', '14:00', 5), (9004, 0, '14:00', '15:00', 3);
INSERT INTO slots (id, date, start_time, end_time, capacity) VALUES
  (9001, (SELECT open_date FROM settings), '10:00', '11:00', 8),
  (9002, (SELECT open_date FROM settings), '11:00', '12:00', 8),
  (9003, (SELECT open_date FROM settings), '13:00', '14:00', 5),
  (9004, (SELECT open_date FROM settings), '14:00', '15:00', 3),
  (9005, (SELECT date(open_date, '+1 day') FROM settings), '10:00', '11:00', 8),
  (9006, (SELECT date(open_date, '+1 day') FROM settings), '11:00', '12:00', 8),
  (9007, (SELECT date(open_date, '+1 day') FROM settings), '13:00', '14:00', 5),
  (9008, (SELECT date(open_date, '+1 day') FROM settings), '14:00', '15:00', 3);
INSERT INTO reservations (slot_id, people, code, created_at, created_by_type, created_by_id) VALUES
  (9002, 2, 'SD2A', datetime('now', '+9 hours'), 'admin', 0),
  (9004, 2, 'SD4B', datetime('now', '+9 hours'), 'admin', 0);
