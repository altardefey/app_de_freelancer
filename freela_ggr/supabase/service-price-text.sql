begin;
create or replace function private.require_service_price() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.price is not distinct from old.price
    and new.fixed_price_cents is not distinct from old.fixed_price_cents
    and new.price_negotiable = old.price_negotiable then return new; end if;

  if new.price_negotiable then
    new.price := 'A combinar';
  elsif new.fixed_price_cents is not null then
    new.price := 'R$ ' || replace((new.fixed_price_cents::numeric / 100)::numeric(12,2)::text, '.', ',');
  else
    new.price := btrim(new.price);
    if new.price is null or char_length(new.price) not between 1 and 10 then
      raise sqlstate 'PT400' using message = 'Informe um valor de até 10 caracteres.';
    end if;
  end if;
  return new;
end;
$$;
commit;
