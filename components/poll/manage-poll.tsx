import { Placement } from "@floating-ui/react-dom-interactions";
import { format } from "date-fns";
import { Trans, useTranslation } from "next-i18next";
import * as React from "react";
import { encodeDateOption } from "utils/date-time-utils";

import Button from "@/components/button";
import Cog from "@/components/icons/cog.svg";
import LockClosed from "@/components/icons/lock-closed.svg";
import LockOpen from "@/components/icons/lock-open.svg";
import Pencil from "@/components/icons/pencil-alt.svg";
import Save from "@/components/icons/save.svg";
import Table from "@/components/icons/table.svg";

import Dropdown, { DropdownItem } from "../dropdown";
import { PollDetailsForm } from "../forms";
import { useModal } from "../modal";
import { useModalContext } from "../modal/modal-provider";
import { usePoll } from "../poll-context";
import { useUpdatePollMutation } from "./mutations";

const PollOptionsForm = React.lazy(() => import("../forms/poll-options-form"));

const ManagePoll: React.VoidFunctionComponent<{
  placement?: Placement;
}> = ({ placement }) => {
  const { t } = useTranslation("app");
  const { poll, options } = usePoll();

  const modalContext = useModalContext();

  const handleChangeOptions = () => {
    if (poll.legacy) {
      modalContext.render({
        overlayClosable: true,
        title: "Sorry!",
        description:
          "This poll was created with an older version of Rallly and does not support this feature.",
        cancelText: "Close",
      });
    } else {
      openChangeOptionsModal();
    }
  };

  const { mutate: updatePollMutation, isLoading: isUpdating } =
    useUpdatePollMutation();
  const [
    changeOptionsModalContextHolder,
    openChangeOptionsModal,
    closeChangeOptionsModal,
  ] = useModal({
    overlayClosable: true,
    okText: "Save",
    okButtonProps: {
      form: "pollOptions",
      htmlType: "submit",
      loading: isUpdating,
    },
    cancelText: "Cancel",
    content: (
      <React.Suspense fallback={null}>
        <PollOptionsForm
          name="pollOptions"
          title={poll.title}
          defaultValues={{
            navigationDate: poll.options[0].value.split("/")[0],
            options: poll.options.map((option) => {
              const [start, end] = option.value.split("/");
              return end
                ? {
                    type: "timeSlot",
                    start,
                    end,
                  }
                : {
                    type: "date",
                    date: start,
                  };
            }),
            timeZone: poll.timeZone ?? "",
          }}
          onSubmit={(data) => {
            const encodedOptions = data.options.map(encodeDateOption);
            const optionsToDelete = poll.options.filter((option) => {
              return !encodedOptions.includes(option.value);
            });

            const optionsToAdd = encodedOptions.filter(
              (encodedOption) =>
                !poll.options.find((o) => o.value === encodedOption),
            );

            const onOk = () => {
              updatePollMutation(
                {
                  timeZone: data.timeZone,
                  optionsToDelete: optionsToDelete.map(({ id }) => id),
                  optionsToAdd,
                },
                {
                  onSuccess: () => closeChangeOptionsModal(),
                },
              );
            };

            const optionsToDeleteThatHaveVotes = optionsToDelete.filter(
              (option) => option.votes.length > 0,
            );

            if (optionsToDeleteThatHaveVotes.length > 0) {
              modalContext.render({
                title: "Are you sure?",
                description: (
                  <Trans
                    t={t}
                    i18nKey="deletingOptionsWarning"
                    components={{ b: <strong /> }}
                  />
                ),
                onOk,
                okButtonProps: {
                  type: "danger",
                },
                okText: "Delete",
                cancelText: "Cancel",
              });
            } else {
              onOk();
            }
          }}
        />
      </React.Suspense>
    ),
  });

  const [
    changePollDetailsModalContextHolder,
    openChangePollDetailsModa,
    closePollDetailsModal,
  ] = useModal({
    overlayClosable: true,
    okText: "Save changes",
    okButtonProps: {
      form: "updateDetails",
      loading: isUpdating,
      htmlType: "submit",
    },
    cancelText: "Cancel",
    content: (
      <PollDetailsForm
        name="updateDetails"
        defaultValues={{
          title: poll.title,
          location: poll.location ?? "",
          description: poll.description ?? "",
        }}
        className="p-4"
        onSubmit={(data) => {
          //submit
          updatePollMutation(data, { onSuccess: closePollDetailsModal });
        }}
      />
    ),
  });
  return (
    <div>
      {changeOptionsModalContextHolder}
      {changePollDetailsModalContextHolder}
      <Dropdown
        placement={placement}
        trigger={<Button icon={<Cog />}>Manage</Button>}
      >
        <DropdownItem
          icon={Pencil}
          label="Edit details"
          onClick={openChangePollDetailsModa}
        />
        <DropdownItem
          icon={Table}
          label="Edit options"
          onClick={handleChangeOptions}
        />
        <DropdownItem
          icon={Save}
          label="Export to CSV"
          onClick={() => {
            const header = [
              t("participantCount", {
                count: poll.participants.length,
              }),
              ...options.map((decodedOption) => {
                const day = `${decodedOption.dow} ${decodedOption.day} ${decodedOption.month}`;
                return decodedOption.type === "date"
                  ? day
                  : `${day} ${decodedOption.startTime} - ${decodedOption.endTime}`;
              }),
            ].join(",");
            const rows = poll.participants.map((participant) => {
              return [
                participant.name,
                ...poll.options.map((option) => {
                  if (
                    participant.votes.some((vote) => {
                      return vote.optionId === option.id;
                    })
                  ) {
                    return "Yes";
                  }
                  return "No";
                }),
              ].join(",");
            });
            const csv = `data:text/csv;charset=utf-8,${[header, ...rows].join(
              "\r\n",
            )}`;

            const encodedCsv = encodeURI(csv);
            var link = document.createElement("a");
            link.setAttribute("href", encodedCsv);
            link.setAttribute(
              "download",
              `${poll.title.replace(/\s/g, "_")}-${format(
                Date.now(),
                "yyyyMMddhhmm",
              )}`,
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
        />
        {poll.closed ? (
          <DropdownItem
            icon={LockOpen}
            label="Unlock poll"
            onClick={() => updatePollMutation({ closed: false })}
          />
        ) : (
          <DropdownItem
            icon={LockClosed}
            label="Lock poll"
            onClick={() => updatePollMutation({ closed: true })}
          />
        )}
      </Dropdown>
    </div>
  );
};

export default ManagePoll;
