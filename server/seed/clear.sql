-- seed.sql で入れたもの（ID 9000番台のコマ・ひな形と、それに付いた予約・受付不可ルール）だけを消す
DELETE FROM reservations WHERE slot_id >= 9000;
DELETE FROM blackout_rules WHERE slot_id >= 9000;
DELETE FROM slots WHERE id >= 9000;
DELETE FROM slot_templates WHERE id >= 9000;
