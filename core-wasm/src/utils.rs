pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function at least once during initialization, and then
    // we will get better error messages if our code ever panics.
    //
    // For more details see
    // https://github.com/rustwasm/console_error_panic_hook#readme
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

pub mod serde {
/// Serializing datetimes with Serde as ISO8601 strings.
pub mod iso8601 {
    use chrono::{DateTime, Utc};
    use serde::de::Visitor;
    use serde::{Deserializer, Serializer};

    struct DateTimeVisitor;
    impl<'de> Visitor<'de> for DateTimeVisitor {
        type Value = DateTime<Utc>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a date string is expected to follow RFC3339 / ISO8601")
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            let date = DateTime::parse_from_rfc3339(v)
                .map_err(|err| E::custom(format!("{:?}", err)))?
                .with_timezone(&Utc);
            Ok(date)
        }
    }

    pub fn serialize<S>(date: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&date.to_rfc3339())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_string(DateTimeVisitor)
    }
}
}

