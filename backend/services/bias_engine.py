import sys
import json
import pandas as pd


def safe_mean(series):
    return None if series.empty else float(series.mean())


def safe_std(series):
    if series.empty:
        return None
    return float(series.std(ddof=0))


def compute_avg_holding_period_days(df):
    if df.empty:
        return None

    required = {"asset", "side", "quantity", "timestamp"}
    if not required.issubset(df.columns):
        return None

    holds = []
    lots_by_asset = {}

    for _, row in df.iterrows():
        side = str(row.get("side", "")).upper()
        asset = row.get("asset")
        ts = row.get("timestamp")
        qty = row.get("quantity")

        if pd.isna(asset) or pd.isna(ts) or pd.isna(qty):
            continue

        qty = float(qty)
        if qty <= 0:
            continue

        if side == "BUY":
            lots_by_asset.setdefault(asset, []).append({"ts": ts, "qty": qty})
            continue

        if side == "SELL":
            queue = lots_by_asset.get(asset, [])
            remaining = qty

            while remaining > 0 and queue:
                lot = queue[0]
                used = min(remaining, lot["qty"])
                days = (ts - lot["ts"]).total_seconds() / 86400.0
                holds.append(days)
                lot["qty"] -= used
                remaining -= used

                if lot["qty"] <= 1e-9:
                    queue.pop(0)

    if not holds:
        return None

    return float(sum(holds) / len(holds))


def compute_user_portfolio_metrics(df):
    trades_by_week = df.groupby(df["timestamp"].dt.to_period("W")).size()
    trades_by_month = df.groupby(df["timestamp"].dt.to_period("M")).size()

    avg_trades_per_week = safe_mean(trades_by_week)
    avg_trades_per_month = safe_mean(trades_by_month)

    trade_value = df["quantity"] * df["entry_price"]
    avg_trade_size = float(trade_value.mean()) if not trade_value.empty else 0.0
    trade_size_variability = safe_std(trade_value)

    prev_loss_mask = df["profit_loss"].shift(1) < 0
    pct_trades_after_loss = None
    if len(df.index) >= 2:
        trades_after_loss = int(prev_loss_mask.iloc[1:].sum())
        pct_trades_after_loss = trades_after_loss / (len(df.index) - 1)

    avg_holding_period_days = compute_avg_holding_period_days(df)

    return {
        "avg_trades_per_week": avg_trades_per_week,
        "avg_trades_per_month": avg_trades_per_month,
        "avg_trade_size": avg_trade_size,
        "trade_size_variability": trade_size_variability,
        "pct_trades_after_loss": pct_trades_after_loss,
        "avg_holding_period_days": avg_holding_period_days,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "csv_path_required"}))
        sys.exit(1)

    csv_path = sys.argv[1]

    # Load data
    df = pd.read_csv(
        csv_path,
        usecols=[
            "timestamp",
            "asset",
            "side",
            "profit_loss",
            "quantity",
            "entry_price",
        ],
    )

    # Preprocess
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    for col in ["profit_loss", "quantity", "entry_price"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["timestamp", "profit_loss", "quantity", "entry_price"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # OVERTRADING
    hourly_index = pd.date_range(
        start=df["timestamp"].min().floor("h"),
        end=df["timestamp"].max().ceil("h"),
        freq="h",
    )

    trades_per_hour = (
        df.groupby(df["timestamp"].dt.floor("h"))
          .size()
          .reindex(hourly_index, fill_value=0)
    )

    avg_trades_per_hour = float(trades_per_hour.mean())
    max_trades_in_one_hour = int(trades_per_hour.max())

    # LOSS AVERSION
    wins = df.loc[df["profit_loss"] > 0, "profit_loss"]
    losses = df.loc[df["profit_loss"] < 0, "profit_loss"].abs()

    avg_win = safe_mean(wins)
    avg_abs_loss = safe_mean(losses)

    disposition_ratio = (
        float(avg_abs_loss / avg_win)
        if avg_win not in (None, 0) and avg_abs_loss is not None
        else None
    )

    # REVENGE TRADING (Standard + Martingale Detection)
    trade_value = df["quantity"] * df["entry_price"]
    avg_trade_value_overall = float(trade_value.mean()) if not trade_value.empty else 0.0

    # 1. Immediate Revenge (Previous Trade was a Loss)
    loss_indices = df.index[df["profit_loss"] < 0]
    next_trade_indices = loss_indices + 1
    next_trade_indices = next_trade_indices[next_trade_indices < len(df)]

    if len(next_trade_indices) > 0:
        avg_trade_value_after_loss = float(trade_value.iloc[next_trade_indices].mean())
    else:
        avg_trade_value_after_loss = None

    revenge_trade_value_ratio = (
        avg_trade_value_after_loss / avg_trade_value_overall
        if avg_trade_value_after_loss is not None and avg_trade_value_overall != 0
        else None
    )
    
    # 2. Martingale Analysis (Sizing up after consecutive loss streaks)
    # Flag losses
    df['is_loss'] = df['profit_loss'] < 0
    
    # Count consecutive streaks. 
    # This creates a unique ID for each streak of True/False values
    streak_id = (df['is_loss'] != df['is_loss'].shift()).cumsum()
    
    # Count the cumulative sum within each streak group
    df['streak_counter'] = df.groupby(streak_id).cumcount() + 1
    
    # We only care about LOSS streaks. Reset win streaks to 0.
    df.loc[~df['is_loss'], 'streak_counter'] = 0
    
    # Shift so we see the streak that happened BEFORE the current trade
    df['prev_loss_streak'] = df['streak_counter'].shift(1).fillna(0)
    
    # Calculate average trade size for each streak bucket
    df['trade_value'] = trade_value
    martingale_stats = df.groupby('prev_loss_streak')['trade_value'].mean().to_dict()
    
    # Check for specific "Martingale" behavior at 6 losses (the "Revenge" threshold)
    size_at_0 = martingale_stats.get(0.0, 0.0)
    size_at_6 = martingale_stats.get(6.0, 0.0)
    martingale_ratio_6 = (size_at_6 / size_at_0) if size_at_0 > 0 else 0.0


    # PORTFOLIO METRICS
    user_portfolio_metrics = compute_user_portfolio_metrics(df)

    # FINAL OUTPUT
    result = {
        "overtrading": {
            "avg_trades_per_hour": avg_trades_per_hour,
            "max_trades_in_one_hour": max_trades_in_one_hour,
        },
        "loss_aversion": {
            "avg_abs_loss": avg_abs_loss,
            "avg_win": avg_win,
            "disposition_ratio": disposition_ratio,
        },
        "revenge_trading": {
            "avg_trade_value_after_loss": avg_trade_value_after_loss,
            "avg_trade_value_overall": avg_trade_value_overall,
            "revenge_trade_value_ratio": revenge_trade_value_ratio,
            "martingale_stats": martingale_stats,
            "martingale_ratio_6_losses": martingale_ratio_6
        },
        "user_portfolio_metrics": user_portfolio_metrics,
    }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()