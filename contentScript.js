//contentScript.js
const html = `<div class="py-2 pl-3 controls-container" style="width:150px;">
                <div class="estimated-container">   
                    <select class="form-select select-sm d-block estimated" style="width:120px;" title="Estimated Time">
                    <option value="">(none)</option>
                        <optgroup label="Minutes">
                        <option value="15 Minutes">15 Minutes</option>
                        <option value="30 Minutes">30 Minutes</option>                                           
                     </optgroup>
                      <optgroup label="Hours">
                        <option value="1 Hour">1 Hour </option>
                        <option value="2 Hours">2 Hours</option>
                        <option value="3 Hours">3 Hours</option>
                        <option value="4 Hours">4 Hours</option>
                        <option value="5 Hours">5 Hours</option>
                        <option value="6 Hours">6 Hours</option>
                        <option value="7 Hours">7 Hours</option>
                        <option value="8 Hours">8 Hours</option>                      
                      </optgroup>
                      <optgroup label="Days">
                        <option value="1 Day">1 Day </option>
                        <option value="2 Days">2 Days</option>
                        <option value="3 Days">3 Days</option>
                        <option value="4 Days">4 Days</option>
                        <option value="5 Days">5 Days</option>
                      </optgroup>
                      <optgroup label="Weeks">
                        <option value="1 Week">1 Week </option>
                        <option value="2 Weeks">2 Weeks</option>
                        <option value="3 Weeks">3 Weeks</option>
                        <option value="4 Weeks">4 Weeks</option>
                      </optgroup>
                      <optgroup label="Months">
                        <option value="1 Month">1 Month </option>
                        <option value="2 Months">2 Months</option>
                      </optgroup>                      
                    </select>                
                </div>
            </div>`;

const issuesEnhancer = {
  token: null,
  username: null,
  repository: null,

  getIssueId($issueRow) {
    const $node = $(
      ".gh-header-title .f1-light, .js-project-issue-details-container .js-issue-number",
      $issueRow
    );

    if ($node.length) {
      const id = $node.html().replace("#", "");

      if (id) {
        return id;
      }
    }

    return null;
  },

  async getIssueMetadata($issueRow) {
    const issueId = this.getIssueId($issueRow);
    if (issueId == null) return;

    const data = await this.getIssue(issueId);

    const metadata = this.parseBody(data.body);

    //Fill data
    $issueRow.data("issueId", issueId);
    $issueRow.data("body", data.body);
    $issueRow.data("metadata", metadata);

    // Fill controls
    $issueRow.find(".estimated").val(metadata.estimated);
  },

  parseBody(body) {
    const $wrapper = $("<div></div>").append(body);

    let metadata = null;

    $wrapper
      .contents()
      .filter(function () {
        return (
          this.nodeType == 8 &&
          this.nodeValue.startsWith("GitHubIssuesEnhancements=")
        );
      })
      .each(function (i, e) {
        const json = e.nodeValue
          .replace("GitHubIssuesEnhancements=", "")
          .trim();
        try {
          obj = JSON.parse(json);
          metadata = {
            ...{
              estimated: "",
            },
            ...obj,
          };
        } catch (e) {
          console.log(e);
        }
      });

    if (metadata == null) {
      metadata = { estimated: "" };
      $wrapper.append('\n\n\n<!--GitHubIssuesEnhancements={"estimated":""}-->');
    }

    return metadata;
  },

  setIssueMetadata($issueRow) {
    const issueId = $issueRow.data("issueId");
    const body = $issueRow.data("body");
    const metadata = $issueRow.data("metadata");

    const $wrapper = $("<div></div>").append(body);

    let found = false;
    $wrapper
      .contents()
      .filter(function () {
        return (
          this.nodeType == 8 &&
          this.nodeValue.startsWith("GitHubIssuesEnhancements=")
        );
      })
      .each(function (i, e) {
        found = true;
        e.nodeValue = "GitHubIssuesEnhancements=" + JSON.stringify(metadata);
      });

    if (!found)
      $wrapper.append('\n\n\n<!--GitHubIssuesEnhancements={"estimated":""}-->');

    this.updateIssue(issueId, $wrapper.html());
  },

  async getIssue(id) {
    let result = null;
    const self = this;
    try {
      result = await $.ajax({
        url: `https://api.github.com/repos/${self.username}/${self.repository}/issues/${id}`,
        dataType: "json",
        type: "GET",
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", "token " + self.token);
        },
        success: function (data) {
          //console.log(data);
        },
        error: function (data) {
          //console.log(data);
        },
      });
    } catch (e) {
      console.log(e);
    }

    return result;
  },

  updateIssue(id, body) {
    const self = this;
    $.ajax({
      url: `https://api.github.com/repos/${self.username}/${self.repository}/issues/${id}`,
      type: "POST",
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "token " + self.token);
      },
      data: JSON.stringify({
        body: body,
      }),
    });
  },

  init() {
    const self = this;

    $(".repository-content").each(function () {
      const $this = $(this);
      const $controls = $(html);

      $this
        .find("#partial-discussion-sidebar .sidebar-assignee")
        .append($controls);
      self.getIssueMetadata($this);
    });

    $(".estimated").change(function (e) {
      const $this = $(this);
      const $issueRow = $this.closest(".repository-content");
      const metadata = $issueRow.data("metadata");

      metadata.estimated = $this.val();
      self.setIssueMetadata($issueRow);
    });

    // in Projects
    const $project = $(".project-columns-container");

    if ($project.length) {
      const doingColumn = $(
        ".js-project-columns-container .project-column"
      ).filter(function () {
        const title = $(this).find(".js-project-column-name").html();

        return title.includes("Doing..");
      });

      if (doingColumn.length) {
        const node = doingColumn.get(0);

        self.updateProjectColumn(doingColumn);

        const handleUpdate = (column) => {
          self.updateProjectColumn($(column));
        };

        self.mutationObserver(node, handleUpdate);
      }
    }
  },

  updateProjectColumn($column) {
    const self = this;

    $column.find("article.issue-card").each(function () {
      const $card = $(this);
      const $node = $card.find(".js-project-card-issue-link");
      const $dataHello = $node.find(".estimationEmpty");
      const issueId = self.getIssueId($card);

      self.getIssue(issueId).then((data) => {
        const metadata = self.parseBody(data.body);

        let htmlContent = "Estimate: " + metadata.estimated;
        let estimationEmpty = "#0e8a16";

        if (metadata.estimated === "") {
          htmlContent = "Estimate is needed!";
          estimationEmpty = "#d73a4a";
        }

        if ($dataHello.length) {
          $dataHello.html(htmlContent);
        } else {
          const html =
            `<div class="estimationEmpty" style="background-color: ` +
            estimationEmpty +
            `; margin: 5px 0; color: #ffffff; padding: 5px 12px; font-size: 12px; font-weight: 500; line-height: 18px; border: 1px solid transparent; border-radius: 2em;">${htmlContent}</div>`;
          $card.find(".js-project-card-issue-link").after(html);
        }
      });
    });
  },

  mutationObserver(node, cb) {
    const callback = function (mutationsList) {
      for (const mutation of mutationsList) {
        const target = mutation.target;

        cb(target);
      }
    };

    const observer = new MutationObserver(callback);

    const config = {
      childList: true,
      subtree: true,
    };

    observer.observe(node, config);
  },

  beforeInit() {
    const self = this;
    const arr = window.location.pathname.split("/");

    if (arr.length < 3) return;
    this.username = arr[1];
    this.repository = arr[2];

    // Read it using the storage API
    chrome.storage.sync.get(["personalAccessToken"], function (items) {
      self.token = items.personalAccessToken;
      self.init();
    });
  },
};

issuesEnhancer.beforeInit();
