/*
 * Copyright (C) 2026 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "src/trace_processor/perfetto_sql/lineage/connection_catalog.h"

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "src/trace_processor/containers/string_pool.h"
#include "src/trace_processor/perfetto_sql/engine/perfetto_sql_connection.h"
#include "src/trace_processor/perfetto_sql/lineage/column_lineage.h"
#include "src/trace_processor/sqlite/sql_source.h"
#include "test/gtest_and_gmock.h"

namespace perfetto::trace_processor::lineage {
namespace {

class ConnectionCatalogTest : public ::testing::Test {
 protected:
  void Exec(const std::string& sql) {
    auto res = connection_->Execute(SqlSource::FromExecuteQuery(sql));
    ASSERT_TRUE(res.ok()) << sql << ": " << res.status().c_message();
  }

  StringPool pool_;
  std::unique_ptr<PerfettoSqlConnection> connection_ =
      PerfettoSqlConnection::CreateConnectionToNewDatabase(&pool_, true);
  ConnectionCatalog catalog_{connection_.get()};
};

TEST_F(ConnectionCatalogTest, APerfettoTableIsADataframe) {
  Exec("CREATE PERFETTO TABLE t AS SELECT 1 AS a, 'x' AS b");
  const std::vector<ResolvedColumn>* columns = catalog_.Dataframe("t");
  ASSERT_NE(columns, nullptr);
  ASSERT_EQ(columns->size(), 3u);
  EXPECT_EQ((*columns)[0].name, "a");
  EXPECT_EQ((*columns)[1].name, "b");
  EXPECT_EQ((*columns)[2].name, "_auto_id");
  ASSERT_TRUE((*columns)[0].type.has_value());
  ASSERT_TRUE((*columns)[1].type.has_value());
  ASSERT_TRUE((*columns)[2].type.has_value());
  EXPECT_TRUE((*columns)[0].type->Is<core::Uint32>());
  EXPECT_TRUE((*columns)[1].type->Is<core::String>());
  EXPECT_TRUE((*columns)[2].type->Is<core::Id>());
}

TEST_F(ConnectionCatalogTest, APlainSqliteTableIsNot) {
  Exec("CREATE TABLE t(a INTEGER)");
  EXPECT_EQ(catalog_.Dataframe("t"), nullptr);
  EXPECT_FALSE(catalog_.ViewSql("t").has_value());
}

TEST_F(ConnectionCatalogTest, AViewHandsBackWhatSqliteStored) {
  Exec("CREATE PERFETTO TABLE t AS SELECT 1 AS a");
  Exec("CREATE VIEW v AS SELECT a FROM t");
  std::optional<std::string> sql = catalog_.ViewSql("v");
  ASSERT_TRUE(sql.has_value());
  EXPECT_THAT(*sql, testing::HasSubstr("SELECT a FROM t"));
}

TEST_F(ConnectionCatalogTest, SomethingWhichIsNeitherIsNeither) {
  EXPECT_EQ(catalog_.Dataframe("nope"), nullptr);
  EXPECT_FALSE(catalog_.ViewSql("nope").has_value());
}

TEST_F(ConnectionCatalogTest, ADataframeCreatedAfterAMissIsFound) {
  EXPECT_EQ(catalog_.Dataframe("t"), nullptr);
  Exec("CREATE PERFETTO TABLE t AS SELECT 1 AS value");
  const std::vector<ResolvedColumn>* columns = catalog_.Dataframe("t");
  ASSERT_NE(columns, nullptr);
  ASSERT_EQ(columns->size(), 2u);
  EXPECT_EQ((*columns)[0].name, "value");
  EXPECT_TRUE((*columns)[0].type->Is<core::Uint32>());
}

TEST_F(ConnectionCatalogTest, AReplacedDataframeRefreshesItsSchema) {
  Exec("CREATE PERFETTO TABLE t AS SELECT 1 AS old_value");
  ASSERT_NE(catalog_.Dataframe("t"), nullptr);
  Exec("CREATE OR REPLACE PERFETTO TABLE t AS SELECT 'x' AS new_value");

  const std::vector<ResolvedColumn>* columns = catalog_.Dataframe("t");
  ASSERT_NE(columns, nullptr);
  ASSERT_EQ(columns->size(), 2u);
  EXPECT_EQ((*columns)[0].name, "new_value");
  ASSERT_TRUE((*columns)[0].type.has_value());
  EXPECT_TRUE((*columns)[0].type->Is<core::String>());
}

TEST_F(ConnectionCatalogTest, ATemporaryViewShadowsAMainView) {
  Exec("CREATE PERFETTO TABLE ints AS SELECT 1 AS value");
  Exec("CREATE PERFETTO TABLE strings AS SELECT 'x' AS value");
  Exec("CREATE VIEW v AS SELECT value FROM ints");
  Exec("CREATE TEMP VIEW v AS SELECT value FROM strings");

  std::optional<std::string> sql = catalog_.ViewSql("v");
  ASSERT_TRUE(sql.has_value());
  EXPECT_THAT(*sql, testing::HasSubstr("strings"));
  auto columns = ResolveRelation("v", catalog_);
  ASSERT_TRUE(columns.ok()) << columns.status().c_message();
  ASSERT_EQ(columns->size(), 1u);
  ASSERT_TRUE((*columns)[0].type.has_value());
  EXPECT_TRUE((*columns)[0].type->Is<core::String>());
}

// The point of the catalog: a query over a real table comes back typed.
TEST_F(ConnectionCatalogTest, AQueryOverADataframeResolves) {
  Exec("CREATE PERFETTO TABLE t AS SELECT 1 AS id, 2.5 AS weight");
  Exec("CREATE VIEW v AS SELECT id AS renamed, weight FROM t");

  auto res =
      ResolveSelect("SELECT renamed, weight * 2 AS scaled FROM v", catalog_);
  ASSERT_TRUE(res.ok()) << res.status().c_message();
  ASSERT_EQ(res->size(), 2u);
  EXPECT_TRUE((*res)[0].type.has_value());
  EXPECT_EQ((*res)[0].dataframe, "t");
  EXPECT_EQ((*res)[0].dataframe_column, "id");
  EXPECT_FALSE((*res)[1].type.has_value());
}

TEST_F(ConnectionCatalogTest, AViewWhichOnlyRenamesReexportsItsSource) {
  Exec("CREATE PERFETTO TABLE t AS SELECT 1 AS id, 2 AS other");
  Exec("CREATE VIEW v AS SELECT id, other FROM t");
  Exec("CREATE VIEW w AS SELECT id AS a, other AS b FROM v");

  auto res = ResolveRelation("w", catalog_);
  ASSERT_TRUE(res.ok()) << res.status().c_message();
  EXPECT_EQ(SoleDataframe(*res), "t");
}

}  // namespace
}  // namespace perfetto::trace_processor::lineage
