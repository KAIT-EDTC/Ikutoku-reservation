-- seed.sql で入れたもの（ID 9000番台のコマと、それに付いた予約）だけを消す
DELETE FROM reservations WHERE slot_id >= 9000;
DELETE FROM slots WHERE id >= 9000;
