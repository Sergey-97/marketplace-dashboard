-- backend/src/sql/calculate_kpi.sql
CREATE OR REPLACE FUNCTION calculate_kpi(
  p_start_date DATE,
  p_end_date DATE,
  p_marketplace TEXT DEFAULT 'all'
)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_orders BIGINT,
  total_quantity BIGINT,
  avg_order_value NUMERIC,
  avg_price NUMERIC,
  growth_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_sales AS (
    SELECT * FROM sales_fact
    WHERE order_date >= p_start_date::timestamptz 
      AND order_date <= p_end_date::timestamptz
      AND (p_marketplace = 'all' OR marketplace = p_marketplace)
  ),
  period_metrics AS (
    SELECT
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COUNT(DISTINCT order_id) as total_orders,
      COALESCE(SUM(quantity), 0) as total_quantity
    FROM filtered_sales
  ),
  previous_period AS (
    SELECT COALESCE(SUM(total_amount), 0) as prev_revenue
    FROM sales_fact
    WHERE order_date >= (p_start_date - (p_end_date - p_start_date))::timestamptz
      AND order_date < p_start_date::timestamptz
      AND (p_marketplace = 'all' OR marketplace = p_marketplace)
  )
  SELECT
    pm.total_revenue,
    pm.total_orders,
    pm.total_quantity,
    CASE WHEN pm.total_orders > 0 THEN pm.total_revenue / pm.total_orders ELSE 0 END,
    CASE WHEN pm.total_quantity > 0 THEN pm.total_revenue / pm.total_quantity ELSE 0 END,
    CASE 
      WHEN pp.prev_revenue > 0 THEN 
        ROUND(((pm.total_revenue - pp.prev_revenue) / pp.prev_revenue * 100)::numeric, 2)
      ELSE 0
    END
  FROM period_metrics pm, previous_period pp;
END;
$$ LANGUAGE plpgsql;