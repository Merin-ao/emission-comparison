import { DataLakeError, getLatestNoonReport, type NoonReportPD } from "../data-lake.ts";
import { getNoonReportFixture } from "../fixtures.ts";

type NoonReportSummary = {
  imo: number;
  voyageNr: string | null;
  reportType: string | null;
  datetimeGmt: string;
  position: {
    latitude: number | null;
    longitude: number | null;
    courseOverGround: number | null;
    speedOverGround: number | null;
    distanceRun24h: number | null;
  } | null;
  weatherObserved: {
    windSpeedKn: number | null;
    windDirectionDeg: number | null;
    waveHeightM: number | null;
    swellHeightM: number | null;
    beaufort: number | null;
  } | null;
  bunkers: { fuelGrade: string | null; robTonnes: number | null }[];
  consumption24h: { fuelGrade: string | null; consumedTonnes: number | null }[];
  originPort: {
    unlocode: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  destinationPort: {
    unlocode: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

const trim = (report: NoonReportPD): NoonReportSummary => {
  const nav = report.navigational_data;
  const wx = report.weather_conditions;

  return {
    imo: report.imo,
    voyageNr: report.voyage_nr ?? null,
    reportType: report.report_type ?? null,
    datetimeGmt: report.datetime_gmt,
    position: nav
      ? {
          latitude: nav.latitude ?? null,
          longitude: nav.longitude ?? null,
          courseOverGround: nav.course_over_ground ?? null,
          speedOverGround: nav.speed_over_ground ?? null,
          distanceRun24h: nav.distance_run ?? null,
        }
      : null,
    weatherObserved: wx
      ? {
          windSpeedKn: wx.wind_speed_kn ?? null,
          windDirectionDeg: wx.wind_direction_deg ?? null,
          waveHeightM: wx.wave_height_m ?? null,
          swellHeightM: wx.swell_height_m ?? null,
          beaufort: wx.beaufort ?? null,
        }
      : null,
    bunkers: (report.robs ?? []).map((r) => ({
      fuelGrade: r.fuel_grade ?? null,
      robTonnes: r.rob_tonnes ?? null,
    })),
    consumption24h: (report.consumptions ?? []).map((c) => ({
      fuelGrade: c.fuel_grade ?? null,
      consumedTonnes: c.consumed_tonnes ?? null,
    })),
    originPort: report.origin_port
      ? {
          unlocode: report.origin_port.unlocode ?? null,
          name: report.origin_port.name ?? null,
          latitude: report.origin_port.latitude ?? null,
          longitude: report.origin_port.longitude ?? null,
        }
      : null,
    destinationPort: report.destination_port
      ? {
          unlocode: report.destination_port.unlocode ?? null,
          name: report.destination_port.name ?? null,
          latitude: report.destination_port.latitude ?? null,
          longitude: report.destination_port.longitude ?? null,
        }
      : null,
  };
};

type NoonReportResponse = {
  imo: number;
  status: "ok" | "no_report";
  /** "live" when the noon report came from the data-lake, "fixture" when from a
   * hand-authored demo-only fallback (the stage `demo` tenant has no noon
   * reports). Always "live" when status is "no_report". */
  dataSource: "live" | "fixture";
  report: NoonReportSummary | null;
  message: string | null;
};

const handleGetVesselNoonReport = async (
  imo: number,
  authHeader: string | undefined,
): Promise<NoonReportResponse> => {
  try {
    const report = await getLatestNoonReport(imo, authHeader);
    return { imo, status: "ok", dataSource: "live", report: trim(report), message: null };
  } catch (err) {
    if (err instanceof DataLakeError && err.status === 404) {
      // Fixture fallback — only when the live API has nothing on file.
      const fixture = getNoonReportFixture(imo);
      if (fixture !== null) {
        return {
          imo,
          status: "ok",
          dataSource: "fixture",
          report: fixture,
          message:
            "Demo fixture noon report — the live data-lake has none on file for this IMO in the current tenant.",
        };
      }
      return {
        imo,
        status: "no_report",
        dataSource: "live",
        report: null,
        message:
          `No noon report on file for IMO ${imo}. ` +
          "Fall back to AIS trail (vessel_get_vessel_trail / vessel_get_vessel_positions) and acknowledge the gap.",
      };
    }
    throw err;
  }
};

export { handleGetVesselNoonReport };
export type { NoonReportResponse, NoonReportSummary };
