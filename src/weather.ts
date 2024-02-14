import { DateTime } from "luxon";
import { WeatherSnapshot } from "./types";
import { interpolate } from "./math";

export interface WeatherSource {
  getWeather(localTime: DateTime): WeatherSnapshot;
}

interface JSONWeatherEntry extends WeatherSnapshot {
  datetime: string;
}

export class JSONBackedHourlyWeatherSource implements WeatherSource {
  private entryByHour: { [key: string]: JSONWeatherEntry } = {};

  constructor(entries: JSONWeatherEntry[]) {
    for (let entry of entries) {
      const dt = DateTime.fromISO(entry.datetime);
      this.entryByHour[this.hourKey(dt)] = entry;
    }
  }

  private hourKey(datetime: DateTime): string {
    // Make sure we convert to UTC first to get the hour of the day!
    return datetime.toUTC().toFormat("yyyy-LL-dd HH");
  }

  private getWeatherForHour(localTime: DateTime): WeatherSnapshot {
    const hourKey = this.hourKey(localTime);
    if (!(hourKey in this.entryByHour)) {
      throw new Error(`No entry for ${hourKey}`);
    }
    return this.entryByHour[hourKey];
  }

  getWeather(localTime: DateTime): WeatherSnapshot {
    const startOfHour = localTime.startOf("hour");

    // We use hour plus one rather than .endOf("hour") here because
    // the end of the hour gives :59:59.99. If you ask for the hourKey
    // for that hour, you get the same hour.
    const endOfHour = startOfHour.plus({ hours: 1 });

    const startWeather = this.getWeatherForHour(startOfHour);
    if (localTime.equals(startOfHour)) {
      // Small optimization
      return startWeather;
    }
    const endWeather = this.getWeatherForHour(endOfHour);

    // For times in-between hours, we'll interpolate.  Many of these functions
    // are, of course, not linear, but we'll assume they are as a rough
    // estimate.
    const startMillis = startOfHour.toMillis();
    const endMillis = endOfHour.toMillis();
    const targetMillis = localTime.toMillis();

    const outsideAirTempF = interpolate(
      startMillis,
      startWeather.outsideAirTempF,
      endMillis,
      endWeather.outsideAirTempF,
      targetMillis
    );

    const relativeHumidityPercent = interpolate(
      startMillis,
      startWeather.relativeHumidityPercent,
      endMillis,
      endWeather.relativeHumidityPercent,
      targetMillis
    );

    // This one is a little dicey without directional information.  Since we're
    // just interpolating within an hour though, it should be fine
    const windSpeedMph = interpolate(
      startMillis,
      startWeather.windSpeedMph,
      endMillis,
      endWeather.windSpeedMph,
      targetMillis
    );

    const cloudCoverPercent = interpolate(
      startMillis,
      startWeather.cloudCoverPercent,
      endMillis,
      endWeather.cloudCoverPercent,
      targetMillis
    );

    const solarIrradiance = {
      altitudeDegrees: interpolate(
        startMillis,
        startWeather.solarIrradiance.altitudeDegrees,
        endMillis,
        endWeather.solarIrradiance.altitudeDegrees,
        targetMillis
      ),
      wattsPerSquareMeter: interpolate(
        startMillis,
        startWeather.solarIrradiance.wattsPerSquareMeter,
        endMillis,
        endWeather.solarIrradiance.wattsPerSquareMeter,
        targetMillis
      ),
    };

    if (solarIrradiance.altitudeDegrees < 0) {
      solarIrradiance.wattsPerSquareMeter = 0;
    }

    return {
      outsideAirTempF,
      relativeHumidityPercent,
      windSpeedMph,
      cloudCoverPercent,
      solarIrradiance,
    };
  }
}
